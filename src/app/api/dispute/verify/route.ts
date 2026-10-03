import { NextResponse } from "next/server";
import { z } from "zod";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { OTP_MAX_ATTEMPTS } from "@/lib/disputes/server";
import { checkOtp } from "@/lib/otp";

const Body = z.object({
  verification_id: z.string().uuid(),
  code: z.string().trim().regex(/^\d{4,8}$/, "Enter the code from the SMS."),
});

const fail = (status: number, error: string, code?: string) => NextResponse.json({ error, code }, { status });

/**
 * POST /api/dispute/verify { verification_id, code }
 * Step 2: checks the SMS code. On success, opens a dispute for each chosen
 * report and marks it "disputed" (still public, labelled, until a moderator
 * decides).
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0].message);

  const ipHash = hashValue("ip", await getClientIp());
  if (!(await hitRateLimit(ipHash, "dispute_verify_ip", 3600, 20))) {
    return fail(429, "Too many attempts. Please try again later.", "rate_limited");
  }

  const db = createAdminClient();
  const { data: v } = await db
    .from("dispute_verifications")
    .select("*")
    .eq("id", parsed.data.verification_id)
    .maybeSingle();
  if (!v || v.verified_at) return fail(400, "This code has already been used or doesn't exist. Start again.", "invalid");
  if (Date.parse(v.expires_at) < Date.now()) return fail(400, "This code has expired. Request a new one.", "expired");
  // Count the attempt atomically before checking, so parallel guesses can't bypass the cap.
  const { data: attempts } = await db.rpc("bump_dispute_attempt", { p_id: v.id });
  if (attempts == null) return fail(400, "This code has expired. Request a new one.", "expired");
  if (attempts > OTP_MAX_ATTEMPTS) return fail(400, "Too many wrong codes. Request a new one.", "locked");

  const ok = await checkOtp(v.provider, v.phone_e164, parsed.data.code, v.code_hash);
  if (!ok) {
    const left = OTP_MAX_ATTEMPTS - attempts;
    return fail(400, left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong codes. Request a new one.", "wrong_code");
  }

  // Mark used first; the conditional update makes a double submit a no-op.
  const { data: claimed } = await db
    .from("dispute_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", v.id)
    .is("verified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return fail(400, "This code has already been used.", "invalid");

  // Only reports that are still approved can move to disputed.
  const { data: reports } = await db.from("reports").select("id").in("id", v.report_ids).eq("status", "approved");
  const ids = (reports ?? []).map((r) => r.id);
  if (ids.length > 0) {
    await db.from("disputes").insert(
      ids.map((id) => ({ report_id: id, claimant_phone: v.phone_e164, verified: true, reason: v.reason, status: "open" as const })),
    );
    await db.from("reports").update({ status: "disputed" }).in("id", ids).eq("status", "approved");
  }

  return NextResponse.json({ disputed: ids.length });
}
