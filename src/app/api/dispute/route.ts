import { NextResponse } from "next/server";
import { z } from "zod";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBasicNumberDetails } from "@/lib/lookup/phone/details";
import { OTP_TTL_MINUTES, publicReportsForNumber } from "@/lib/disputes/server";
import { OtpUnavailableError, activeOtpProvider, sendOtp } from "@/lib/otp";

const Body = z.object({
  phone: z.string().trim().min(1).max(32),
  report_ids: z.array(z.string().uuid()).min(1, "Choose at least one report to dispute.").max(20),
  reason: z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(10, "Please explain why in at least 10 characters.").max(1000, "Keep it under 1000 characters.")),
});

const fail = (status: number, error: string, code?: string) => NextResponse.json({ error, code }, { status });

/**
 * POST /api/dispute { phone, report_ids, reason }
 * Step 1 of "This is my number, dispute a report": checks the reports belong
 * to the number, then texts a one-time code to that number to prove ownership.
 * Nothing changes until the code is verified (POST /api/dispute/verify).
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);
  const details = getBasicNumberDetails(parsed.data.phone);
  if (!details) return fail(400, "Enter a valid phone number.");

  // Limit SMS sends per number and per IP (SMS costs money and can be abused).
  const ipHash = hashValue("ip", await getClientIp());
  const [phoneOk, ipOk] = await Promise.all([
    hitRateLimit(hashValue("phone", details.e164), "dispute_otp_phone", 3600, 3),
    hitRateLimit(ipHash, "dispute_otp_ip", 3600, 5),
  ]);
  if (!phoneOk || !ipOk) return fail(429, "Too many codes requested. Please try again in an hour.", "rate_limited");

  const db = createAdminClient();
  const reports = await publicReportsForNumber(db, details.e164);
  const disputable = new Set(reports.filter((r) => r.disputable).map((r) => r.id));
  const ids = [...new Set(parsed.data.report_ids)];
  if (!ids.every((id) => disputable.has(id))) {
    return fail(400, "Some of those reports can't be disputed. Refresh and try again.", "invalid_reports");
  }

  let provider;
  try {
    provider = activeOtpProvider();
  } catch (e) {
    if (e instanceof OtpUnavailableError) return fail(503, "Disputes are temporarily unavailable. Please try again later.");
    throw e;
  }

  let codeHash: string | null;
  try {
    ({ codeHash } = await sendOtp(provider, details.e164));
  } catch (e) {
    console.error("[dispute] OTP send failed", (e as Error).message);
    return fail(502, "We couldn't send a code to that number. Please check it and try again.");
  }

  const { data, error } = await db
    .from("dispute_verifications")
    .insert({
      phone_e164: details.e164,
      report_ids: ids,
      reason: parsed.data.reason,
      provider,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
      ip_hash: ipHash,
    })
    .select("id")
    .single();
  if (error || !data) return fail(500, "Something went wrong. Please try again.");

  return NextResponse.json({ verification_id: data.id, phone: details.formatted, expires_in: OTP_TTL_MINUTES * 60 });
}
