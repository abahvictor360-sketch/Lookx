import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { TRUST_MIN_ACCOUNT_DAYS, TRUST_REJECTION_WINDOW_DAYS } from "./constants";

type Admin = ReturnType<typeof createAdminClient>;

export const EVIDENCE_BUCKET = "report-evidence";

/** Whether this user's reports can go public without moderation. */
export async function isTrustedReporter(db: Admin, userId: string, accountCreatedAt: string) {
  const ageDays = (Date.now() - Date.parse(accountCreatedAt)) / 86_400_000;
  if (ageDays < TRUST_MIN_ACCOUNT_DAYS) return false;

  const since = new Date(Date.now() - TRUST_REJECTION_WINDOW_DAYS * 86_400_000).toISOString();
  const [approved, rejected] = await Promise.all([
    db.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", userId).eq("status", "approved"),
    db
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", userId)
      .eq("status", "rejected")
      .gte("moderated_at", since),
  ]);
  return (approved.count ?? 0) >= 1 && (rejected.count ?? 0) === 0;
}

/** The image (perceptual hash row) an image lookup matched, if any. */
export async function imageIdForLookup(db: Admin, lookupId: string) {
  const { data } = await db.from("lookups").select("image_id").eq("id", lookupId).eq("type", "image").maybeSingle();
  if (data?.image_id) return data.image_id;
  // Older lookups: fall back to the upload record.
  const { data: upload } = await db
    .from("image_uploads")
    .select("image_id")
    .eq("lookup_id", lookupId)
    .not("image_id", "is", null)
    .limit(1)
    .maybeSingle();
  return upload?.image_id ?? null;
}
