import { NextResponse } from "next/server";
import { z } from "zod";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBasicNumberDetails } from "@/lib/lookup/phone/details";
import { publicReportsForNumber } from "@/lib/disputes/server";

const Body = z.object({ phone: z.string().trim().min(1).max(32) });

/** POST /api/dispute/reports { phone } — the public reports a number owner can dispute. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const details = parsed.success ? getBasicNumberDetails(parsed.data.phone) : null;
  if (!details) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  const ipHash = hashValue("ip", await getClientIp());
  if (!(await hitRateLimit(ipHash, "dispute_list", 3600, 30))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const reports = await publicReportsForNumber(createAdminClient(), details.e164);
  return NextResponse.json({ phone: { e164: details.e164, formatted: details.formatted }, reports });
}
