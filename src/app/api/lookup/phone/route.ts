import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getBasicNumberDetails } from "@/lib/lookup/phone/details";
import { runPhonePipeline } from "@/lib/lookup/phone/pipeline";
import { createPhoneLookup } from "@/lib/lookup/phone/create";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp, getOrCreateDeviceId } from "@/lib/request-meta";
import { createClient } from "@/lib/supabase/server";
import { GUEST_PHONE_LOOKUPS_PER_DAY } from "@/lib/plans";
import { hasPriority } from "@/lib/priority";

// The pipeline runs in after(); give it room beyond the 10s target.
export const maxDuration = 30;

const Body = z.object({ phone: z.string().trim().min(1).max(32) });

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status });

/**
 * POST /api/lookup/phone  { phone }
 * Validates, rate-limits and charges the lookup, stores instant number details,
 * returns { id } immediately, then runs the full pipeline in the background.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_input", "Enter a phone number.");

  const details = getBasicNumberDetails(parsed.data.phone);
  if (!details) {
    return fail(400, "invalid_phone", "That doesn't look like a valid phone number. Try 08012345678 or +2348012345678.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ipHash = hashValue("ip", await getClientIp());

  // Burst limits for everyone (per IP), and per user when signed in.
  if (!(await hitRateLimit(ipHash, "lookup_burst_ip", 600, 30))) {
    return fail(429, "rate_limited", "Too many lookups from your network. Please wait a few minutes.");
  }
  const priority = await hasPriority(supabase, user?.id);
  if (user && !(await hitRateLimit(`user:${user.id}`, "lookup_burst_user", 600, priority ? 60 : 20))) {
    return fail(429, "rate_limited", "You're looking up numbers very quickly. Please wait a few minutes.");
  }

  // Guests: 2 phone lookups per day, tracked by IP AND device.
  if (!user) {
    const deviceHash = hashValue("device", await getOrCreateDeviceId());
    const day = 86_400;
    const [ipOk, deviceOk] = await Promise.all([
      hitRateLimit(ipHash, "guest_phone_day", day, GUEST_PHONE_LOOKUPS_PER_DAY),
      hitRateLimit(deviceHash, "guest_phone_day", day, GUEST_PHONE_LOOKUPS_PER_DAY),
    ]);
    if (!ipOk || !deviceOk) {
      return fail(
        429,
        "guest_limit",
        `You've used your ${GUEST_PHONE_LOOKUPS_PER_DAY} free lookups for today. Create a free account for 5 more every month.`,
      );
    }
  }

  const created = await createPhoneLookup({ phone: details.e164, userId: user?.id ?? null, ipHash });
  if (!created.ok) return fail(created.status, created.code, created.error);

  const lookupId = created.id;
  after(() => runPhonePipeline(lookupId, created.queryHash, created.details, { priority }));

  return NextResponse.json({ id: lookupId });
}
