import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LookupStatus, RiskLevel } from "@/lib/supabase/database.types";
import type { PhoneResults } from "./phone/types";
import type { ImageResults } from "./image/types";
import { signedImageUrl } from "./image/storage";

type Base = {
  id: string;
  status: LookupStatus;
  risk_level: RiskLevel | null;
  created_at: string;
  /** Only meaningful to the viewer; never reveals who ran the lookup. */
  viewer: { isOwner: boolean; isSignedIn: boolean; saved: boolean };
};

export type PublicPhoneLookup = Base & { type: "phone"; results: PhoneResults };
export type PublicImageLookup = Base & {
  type: "image";
  results: ImageResults;
  /** Signed thumbnail URL (1h) while the upload exists; null once deleted. */
  thumbnailUrl: string | null;
};
export type PublicLookup = PublicPhoneLookup | PublicImageLookup;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Loads a lookup for its shareable link. Anyone with the link may view it, so
 * everything about the searcher (user id, IP hash, billing) is stripped, as is
 * the internal storage path of uploaded images.
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

  const base: Base = {
    id: data.id,
    status: data.status,
    risk_level: data.risk_level,
    created_at: data.created_at,
    viewer: { isOwner, isSignedIn: Boolean(user), saved: isOwner && data.saved },
  };

  if (data.type === "phone") {
    return { ...base, type: "phone", results: data.raw_results as PhoneResults };
  }

  const results = data.raw_results as ImageResults;
  const live = Date.parse(results.image.expiresAt) > Date.now();
  const thumbnailUrl = live ? await signedImageUrl(results.image.storagePath, 3600) : null;
  return {
    ...base,
    type: "image",
    thumbnailUrl,
    results: { ...results, image: { ...results.image, storagePath: "" } },
  };
}
