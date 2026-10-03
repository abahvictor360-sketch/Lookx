import { NextResponse } from "next/server";
import { hitRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_BUCKET, IMAGE_RETENTION_HOURS } from "@/lib/lookup/image/storage";

/**
 * POST /api/lookup/image/upload-url
 * Issues a one-time signed URL so the browser can upload straight to the
 * private bucket. This avoids the ~4.5MB request body limit on serverless
 * functions. The file is validated by POST /api/lookup/image afterwards, and
 * is deleted after 24 hours whether or not it becomes a lookup.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Image lookups need a free account.", code: "needs_account" }, { status: 401 });
  }
  if (!(await hitRateLimit(`user:${user.id}`, "image_upload_url", 600, 20))) {
    return NextResponse.json({ error: "Too many uploads. Please wait a few minutes.", code: "rate_limited" }, { status: 429 });
  }

  const admin = createAdminClient();
  const path = `${user.id}/${crypto.randomUUID()}`;
  const { data, error } = await admin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[upload-url] failed", error?.message);
    return NextResponse.json({ error: "Something went wrong. Please try again.", code: "server_error" }, { status: 500 });
  }
  await admin.from("image_uploads").insert({
    storage_path: path,
    expires_at: new Date(Date.now() + IMAGE_RETENTION_HOURS * 3_600_000).toISOString(),
  });
  return NextResponse.json({ path: data.path, token: data.token });
}
