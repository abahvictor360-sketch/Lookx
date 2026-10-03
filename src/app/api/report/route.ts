import { NextResponse } from "next/server";
import { z } from "zod";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBasicNumberDetails } from "@/lib/lookup/phone/details";
import { inspectImage } from "@/lib/lookup/image/decode";
import {
  MAX_DESCRIPTION,
  MAX_EVIDENCE_BYTES,
  MIN_DESCRIPTION,
  REPORT_CATEGORIES,
  REPORT_PLATFORMS,
} from "@/lib/reports/constants";
import { EVIDENCE_BUCKET, imageIdForLookup, isTrustedReporter } from "@/lib/reports/server";
import type { ReportCategory, ReportPlatform } from "@/lib/supabase/database.types";

const fail = (status: number, code: string, error: string) => NextResponse.json({ error, code }, { status });

/** Strip control characters (keep newlines) and collapse runs of blank lines. */
const cleanText = (s: string) =>
  s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim();

const Fields = z.object({
  target_type: z.enum(["phone", "image"]),
  phone: z.string().max(32).optional(),
  lookup_id: z.string().uuid().optional(),
  category: z.enum(REPORT_CATEGORIES.map((c) => c.value) as [ReportCategory, ...ReportCategory[]]),
  platform: z.enum(REPORT_PLATFORMS.map((p) => p.value) as [ReportPlatform, ...ReportPlatform[]]),
  description: z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(MIN_DESCRIPTION, `Please describe what happened in at least ${MIN_DESCRIPTION} characters.`)
        .max(MAX_DESCRIPTION, `Keep the description under ${MAX_DESCRIPTION} characters.`),
    ),
  confirm: z.literal("yes", { message: "Please confirm the report is truthful." }),
});

/**
 * POST /api/report (multipart)
 * Logged-in users report a phone number or an image they looked up.
 * One report per user per target. Reports from accounts that aren't trusted
 * yet are held for moderation. Optional screenshot evidence is stored
 * privately and only visible to moderators.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "needs_account", "Sign in to report a number or image.");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_EVIDENCE_BYTES + 256 * 1024) return fail(413, "too_large", "The screenshot is too large.");
  const form = await request.formData().catch(() => null);
  if (!form) return fail(400, "invalid_input", "Invalid form.");

  const parsed = Fields.safeParse({
    target_type: form.get("target_type"),
    phone: form.get("phone") || undefined,
    lookup_id: form.get("lookup_id") || undefined,
    category: form.get("category"),
    platform: form.get("platform"),
    description: form.get("description") ?? "",
    confirm: form.get("confirm"),
  });
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0].message);
  const input = parsed.data;

  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("banned, created_at").eq("id", user.id).single();
  if (!profile) return fail(403, "no_profile", "Your account isn't ready yet. Please try again.");
  if (profile.banned) return fail(403, "banned", "This account has been suspended.");

  const ipHash = hashValue("ip", await getClientIp());
  const [userOk, ipOk] = await Promise.all([
    hitRateLimit(`user:${user.id}`, "report_day", 86_400, 5),
    hitRateLimit(ipHash, "report_day_ip", 86_400, 20),
  ]);
  if (!userOk || !ipOk) return fail(429, "rate_limited", "You've sent a lot of reports today. Please try again tomorrow.");

  // ---- Resolve the target ----------------------------------------------------
  let targetId: string;
  if (input.target_type === "phone") {
    const details = input.phone ? getBasicNumberDetails(input.phone) : null;
    if (!details) return fail(400, "invalid_phone", "Enter a valid phone number.");
    // Find the number, or create it (without overwriting richer carrier data).
    let { data } = await db.from("phone_numbers").select("id").eq("e164_number", details.e164).maybeSingle();
    if (!data) {
      ({ data } = await db
        .from("phone_numbers")
        .upsert(
          { e164_number: details.e164, country: details.country, carrier: details.carrier, line_type: details.lineType },
          { onConflict: "e164_number" },
        )
        .select("id")
        .single());
    }
    if (!data) return fail(500, "server_error", "Something went wrong. Please try again.");
    targetId = data.id;
  } else {
    const imageId = input.lookup_id ? await imageIdForLookup(db, input.lookup_id) : null;
    if (!imageId) return fail(400, "invalid_image", "Look up the image first, then report it from the results page.");
    targetId = imageId;
  }

  const { data: existing } = await db
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("target_type", input.target_type)
    .eq("target_id", targetId)
    .maybeSingle();
  if (existing) return fail(409, "duplicate", `You've already reported this ${input.target_type === "phone" ? "number" : "image"}.`);

  // ---- Optional evidence screenshot ------------------------------------------
  let evidencePath: string | null = null;
  const evidence = form.get("evidence");
  if (evidence instanceof File && evidence.size > 0) {
    if (evidence.size > MAX_EVIDENCE_BYTES) return fail(413, "too_large", "The screenshot is too large.");
    const buf = Buffer.from(await evidence.arrayBuffer());
    let mime: string;
    try {
      mime = (await inspectImage(buf)).mime;
    } catch {
      return fail(400, "invalid_evidence", "The screenshot must be a JPG, PNG or WEBP image.");
    }
    evidencePath = `${user.id}/${crypto.randomUUID()}`;
    const up = await db.storage.from(EVIDENCE_BUCKET).upload(evidencePath, buf, { contentType: mime });
    if (up.error) return fail(500, "server_error", "Couldn't save the screenshot. Please try again.");
  }

  // ---- Create ------------------------------------------------------------------
  const trusted = await isTrustedReporter(db, user.id, profile.created_at);
  const { data: report, error } = await db
    .from("reports")
    .insert({
      reporter_id: user.id,
      target_type: input.target_type,
      target_id: targetId,
      category: input.category,
      platform: input.platform,
      description: input.description,
      evidence_path: evidencePath,
      status: trusted ? "approved" : "pending",
    })
    .select("id, status")
    .single();

  if (error || !report) {
    if (evidencePath) await db.storage.from(EVIDENCE_BUCKET).remove([evidencePath]);
    if (error?.code === "23505") return fail(409, "duplicate", "You've already reported this.");
    console.error("[report] insert failed", error?.message);
    return fail(500, "server_error", "Something went wrong. Please try again.");
  }

  return NextResponse.json({ id: report.id, status: report.status });
}
