import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashValue } from "@/lib/hash";
import type { Json } from "@/lib/supabase/database.types";
import { getBasicNumberDetails } from "./details";
import type { NumberDetails } from "./types";

export type CreateResult =
  | { ok: true; id: string; details: NumberDetails; queryHash: string }
  | { ok: false; status: number; code: string; error: string };

/**
 * Validate, charge and create a phone lookup row (without running the
 * pipeline). Shared by the website, the public API and bulk lookups so every
 * path bills and logs identically.
 */
export async function createPhoneLookup(input: {
  phone: string;
  userId: string | null;
  teamId?: string | null;
  ipHash: string | null;
  apiKeyId?: string | null;
  bulkJobId?: string | null;
}): Promise<CreateResult> {
  const details = getBasicNumberDetails(input.phone);
  if (!details) {
    return { ok: false, status: 400, code: "invalid_phone", error: "That doesn't look like a valid phone number. Try 08012345678 or +2348012345678." };
  }

  const db = createAdminClient();
  const queryHash = hashValue("phone", details.e164);
  const { data, error } = await db.rpc("start_lookup", {
    p_user_id: input.userId,
    p_type: "phone",
    p_query_hash: queryHash,
    p_normalized_query: details.e164,
    p_ip_hash: input.ipHash,
    p_raw_results: { number: details } as Json,
    p_team_id: input.teamId ?? null,
  });
  const started = data?.[0];

  if (error || !started) {
    console.error("[lookup] start_lookup failed", error?.message);
    return { ok: false, status: 500, code: "server_error", error: "Something went wrong. Please try again." };
  }
  switch (started.error) {
    case "banned":
      return { ok: false, status: 403, code: "banned", error: "This account has been suspended for breaking the acceptable use policy." };
    case "no_credits":
      return {
        ok: false,
        status: 402,
        code: "no_credits",
        error: input.teamId ? "Your team has used this month's lookups and has no credits left." : "You've used this month's free lookups and have no credits left.",
      };
    case "team_inactive":
      return { ok: false, status: 403, code: "team_inactive", error: "This business account is inactive. Contact LookX support." };
  }
  if (!started.lookup_id) return { ok: false, status: 500, code: "server_error", error: "Something went wrong. Please try again." };

  if (input.apiKeyId || input.bulkJobId) {
    await db
      .from("lookups")
      .update({ api_key_id: input.apiKeyId ?? null, bulk_job_id: input.bulkJobId ?? null })
      .eq("id", started.lookup_id);
  }
  return { ok: true, id: started.lookup_id, details, queryHash };
}
