import { NextResponse, after } from "next/server";
import { z } from "zod";
import { apiError, authenticateApi } from "@/lib/api/auth";
import { serializePhoneLookup } from "@/lib/api/serialize";
import { createPhoneLookup } from "@/lib/lookup/phone/create";
import { runPhonePipeline } from "@/lib/lookup/phone/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
const WAIT_MS = 25_000;

const Body = z.object({ phone: z.string().trim().min(1).max(32), wait: z.boolean().optional() });

/**
 * POST /api/v1/lookups/phone  { phone, wait? = true }
 * Billed to the API key's team. With wait (default) the full result is
 * returned when ready (up to ~25s); otherwise poll GET /api/v1/lookups/{id}.
 */
export async function POST(request: Request) {
  const auth = await authenticateApi(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request", "Body must be JSON: { \"phone\": \"+2348012345678\" }");

  const created = await createPhoneLookup({
    phone: parsed.data.phone,
    userId: null,
    teamId: auth.teamId,
    ipHash: null,
    apiKeyId: auth.keyId,
  });
  if (!created.ok) return apiError(created.status, created.code, created.error);

  const pipeline = runPhonePipeline(created.id, created.queryHash, created.details, { priority: true });
  after(() => pipeline); // keep running even if we stop waiting

  if (parsed.data.wait !== false) {
    await Promise.race([pipeline, new Promise((r) => setTimeout(r, WAIT_MS))]);
  }
  const { data } = await createAdminClient()
    .from("lookups")
    .select("id, status, risk_level, created_at, raw_results")
    .eq("id", created.id)
    .single();
  return NextResponse.json(serializePhoneLookup(data!), { status: data!.status === "processing" ? 202 : 200 });
}
