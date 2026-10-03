import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const IMAGE_BUCKET = "lookup-images";
export const IMAGE_RETENTION_HOURS = 24;

/**
 * Delete uploaded images whose 24h retention has passed. Called hourly by the
 * cron route and opportunistically after each image lookup. The images row
 * (perceptual hash) is kept so re-uploads still match reports.
 */
export async function cleanupExpiredImages(limit = 100) {
  const db = createAdminClient();
  const { data: expired, error } = await db
    .from("image_uploads")
    .select("id, storage_path")
    .is("deleted_at", null)
    .lt("expires_at", new Date().toISOString())
    .limit(limit);
  if (error) throw error;
  if (!expired.length) return 0;

  const paths = expired.map((e) => e.storage_path);
  const { error: removeError } = await db.storage.from(IMAGE_BUCKET).remove(paths);
  if (removeError) throw removeError;

  const now = new Date().toISOString();
  await db.from("image_uploads").update({ deleted_at: now }).in("id", expired.map((e) => e.id));
  await db.from("images").update({ storage_path: null }).in("storage_path", paths);
  return expired.length;
}

/** Short-lived signed URL for a private image (thumbnails, reverse search). */
export async function signedImageUrl(path: string, seconds: number) {
  const { data, error } = await createAdminClient().storage.from(IMAGE_BUCKET).createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
}

/** Prune housekeeping tables: rate-limit windows (2 days) and OTP records (7 days). */
export async function pruneOperationalData() {
  const db = createAdminClient();
  const twoDays = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  await Promise.all([
    db.from("rate_limits").delete().lt("window_start", twoDays),
    db.from("dispute_verifications").delete().lt("created_at", week),
  ]);
}
