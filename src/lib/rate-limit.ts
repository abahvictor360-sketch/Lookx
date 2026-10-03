import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limit backed by public.hit_rate_limit (atomic in Postgres,
 * so it works across serverless instances). Returns true when allowed.
 * Fails open on database errors so an outage doesn't block every user;
 * credits are still enforced separately by start_lookup.
 */
export async function hitRateLimit(identifier: string, action: string, windowSeconds: number, max: number) {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_identifier: identifier,
    p_action: action,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    console.error("[rate-limit] failed", error.message);
    return true;
  }
  return data?.[0]?.allowed ?? true;
}
