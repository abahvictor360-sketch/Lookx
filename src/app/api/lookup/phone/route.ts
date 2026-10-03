import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/lookup/detect";

const Body = z.object({ phone: z.string().trim().min(1).max(32) });

/**
 * POST /api/lookup/phone
 * Phase 1: validates and normalises input only. The full lookup pipeline
 * (carrier, web search, reports, AI summary) is added in Phase 2.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a phone number." }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "That doesn't look like a valid phone number. Try 08012345678 or +2348012345678." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: `Phone lookups aren't live yet. ${phone.formatted} is a valid number.` },
    { status: 501 },
  );
}
