import { NextResponse } from "next/server";
import { z } from "zod";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBasicNumberDetails } from "@/lib/lookup/phone/details";

const Body = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  phone: z.string().trim().max(32).optional(),
  request_type: z.enum(["access", "deletion", "correction", "review_reports", "objection", "other"]),
  details: z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(10, "Please add a few details (at least 10 characters).").max(2000)),
});

/** POST /api/data-request: privacy / data subject requests (NDPA 2023, GDPR). No account needed. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const ipHash = hashValue("ip", await getClientIp());
  if (!(await hitRateLimit(ipHash, "data_request", 86_400, 5))) {
    return NextResponse.json({ error: "Too many requests today. Please try again tomorrow." }, { status: 429 });
  }

  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = getBasicNumberDetails(parsed.data.phone)?.e164 ?? null;
    if (!phone) return NextResponse.json({ error: "That phone number isn't valid." }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("data_requests")
    .insert({ email: parsed.data.email.toLowerCase(), phone_e164: phone, request_type: parsed.data.request_type, details: parsed.data.details, ip_hash: ipHash })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
