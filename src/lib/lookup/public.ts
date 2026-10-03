import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LookupStatus, LookupType, RiskLevel } from "@/lib/supabase/database.types";
import type { PhoneResults } from "./phone/types";

export type PublicLookup = {
  id: string;
  type: LookupType;
  status: LookupStatus;
  risk_level: RiskLevel | null;
  created_at: string;
  results: PhoneResults;
  /** Only meaningful to the viewer; never reveals who ran the lookup. */
  viewer: { isOwner: boolean; isSignedIn: boolean; saved: boolean };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a lookup for its shareable link. Anyone with the link may view it, so
 * we strip everything about the searcher (user id, IP hash, billing).
 */
export async function getPublicLookup(id: string): Promise<PublicLookup | null> {
  if (!UUID.test(id)) return null;

  const { data } = await createAdminClient()
    .from("lookups")
    .select("id, type, status, risk_level, created_at, raw_results, user_id, saved")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const isOwner = Boolean(user && data.user_id === user.id);

  return {
    id: data.id,
    type: data.type,
    status: data.status,
    risk_level: data.risk_level,
    created_at: data.created_at,
    results: data.raw_results as PhoneResults,
    viewer: { isOwner, isSignedIn: Boolean(user), saved: isOwner && data.saved },
  };
}
