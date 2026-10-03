import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRateLimit } from "@/lib/rate-limit";
import { hashApiKey } from "@/lib/teams/server";

export const API_RATE_PER_MINUTE = 60;

export type ApiContext = { keyId: string; teamId: string };

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Authenticate a public API request: `Authorization: Bearer lx_live_...`.
 * The key must exist, not be revoked, and belong to an active team.
 * Each key is limited to API_RATE_PER_MINUTE requests a minute.
 */
export async function authenticateApi(request: Request): Promise<ApiContext | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!/^lx_live_[A-Za-z0-9_-]{20,}$/.test(key)) {
    return apiError(401, "unauthorized", "Missing or malformed API key. Use: Authorization: Bearer lx_live_...");
  }

  const db = createAdminClient();
  const { data: row } = await db
    .from("api_keys")
    .select("id, team_id, revoked_at, last_used_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();
  if (!row || row.revoked_at) return apiError(401, "unauthorized", "Invalid or revoked API key.");

  const { data: team } = await db.from("teams").select("active").eq("id", row.team_id).single();
  if (!team?.active) return apiError(403, "team_inactive", "This business account is inactive.");

  if (!(await hitRateLimit(`apikey:${row.id}`, "api_minute", 60, API_RATE_PER_MINUTE))) {
    return apiError(429, "rate_limited", `Rate limit is ${API_RATE_PER_MINUTE} requests per minute per key.`);
  }

  // Record usage at most once a minute per key.
  if (!row.last_used_at || Date.now() - Date.parse(row.last_used_at) > 60_000) {
    await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  }
  return { keyId: row.id, teamId: row.team_id };
}
