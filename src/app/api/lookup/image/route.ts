import { NextResponse, after } from "next/server";
import { hashValue } from "@/lib/hash";
import { hitRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { MAX_IMAGE_BYTES } from "@/lib/lookup/detect";
import { resolveImageQuestion } from "@/lib/lookup/resolve-question";
import { ImageInputError, inspectImage, perceptualHash } from "@/lib/lookup/image/decode";
import { fetchImageFromUrl } from "@/lib/lookup/image/fetch-url";
import { extractMetadata } from "@/lib/lookup/image/metadata";
import { runImagePipeline } from "@/lib/lookup/image/pipeline";
import { IMAGE_BUCKET, IMAGE_RETENTION_HOURS } from "@/lib/lookup/image/storage";
import type { ImageResults } from "@/lib/lookup/image/types";

export const maxDuration = 45;

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status });

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/**
 * POST /api/lookup/image
 * JSON `{ upload_path }` (file uploaded directly to storage via
 * /api/lookup/image/upload-url), JSON `{ url }` (image link), or multipart
 * `image` (small files only: serverless bodies are capped ~4.5MB). Plus an
 * optional question:
 * `question_id` (admin preset) or `question` (custom, if admins allow it).
 *
 * Validates the real file type, stores the image privately for 24 hours,
 * charges the lookup, returns { id }, then runs the pipeline in the background.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "needs_account", "Image lookups need a free account.");

  // ---- Parse input ---------------------------------------------------------
  const contentType = request.headers.get("content-type") ?? "";
  let file: File | null = null;
  let imageUrl: string | null = null;
  let uploadPath: string | null = null;
  let questionId: string | null = null;
  let questionText: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES + 1024 * 1024) return fail(413, "too_large", "Images must be 10MB or smaller.");
    const form = await request.formData().catch(() => null);
    const f = form?.get("image");
    file = f instanceof File ? f : null;
    const id = form?.get("question_id");
    const q = form?.get("question");
    questionId = typeof id === "string" && id ? id : null;
    questionText = typeof q === "string" ? q : null;
  } else {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    imageUrl = typeof body?.url === "string" ? body.url.trim().slice(0, 2048) : null;
    uploadPath = typeof body?.upload_path === "string" ? body.upload_path : null;
    questionId = typeof body?.question_id === "string" && body.question_id ? body.question_id : null;
    questionText = typeof body?.question === "string" ? body.question : null;
  }
  if (!file && !imageUrl && !uploadPath) return fail(400, "invalid_input", "Upload an image or paste an image link.");

  const admin = createAdminClient();
  // Direct uploads must be this user's own, unused, unexpired upload.
  if (uploadPath) {
    const ownPath = new RegExp(`^${user.id}/[0-9a-f-]{36}$`);
    const { data: pending } = ownPath.test(uploadPath)
      ? await admin
          .from("image_uploads")
          .select("id")
          .eq("storage_path", uploadPath)
          .is("lookup_id", null)
          .is("deleted_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle()
      : { data: null };
    if (!pending) return fail(400, "invalid_input", "That upload has expired. Please choose the image again.");
  }
  const discard = async (path: string) => {
    await admin.storage.from(IMAGE_BUCKET).remove([path]);
    await admin.from("image_uploads").update({ deleted_at: new Date().toISOString() }).eq("storage_path", path);
  };
  if (file && file.size > MAX_IMAGE_BYTES) return fail(413, "too_large", "Images must be 10MB or smaller.");

  const resolved = await resolveImageQuestion(questionId, questionText);
  if (!resolved.ok) return fail(422, resolved.code, resolved.error);

  // ---- Rate limits -----------------------------------------------------------
  const ipHash = hashValue("ip", await getClientIp());
  if (!(await hitRateLimit(ipHash, "lookup_burst_ip", 600, 30))) {
    return fail(429, "rate_limited", "Too many lookups from your network. Please wait a few minutes.");
  }
  if (!(await hitRateLimit(`user:${user.id}`, "image_burst_user", 600, 10))) {
    return fail(429, "rate_limited", "You're looking up images very quickly. Please wait a few minutes.");
  }

  // ---- Load + validate the image ---------------------------------------------
  let buffer: Buffer;
  let sourceDomain: string | null = null;
  let info: Awaited<ReturnType<typeof inspectImage>>;
  let phash: string;
  let metadata: Awaited<ReturnType<typeof extractMetadata>>;
  try {
    if (uploadPath) {
      const { data: blob, error: dlError } = await admin.storage.from(IMAGE_BUCKET).download(uploadPath);
      if (dlError || !blob) throw new ImageInputError("We couldn't find your upload. Please try again.");
      if (blob.size > MAX_IMAGE_BYTES) throw new ImageInputError("Images must be 10MB or smaller.");
      buffer = Buffer.from(await blob.arrayBuffer());
    } else if (file) {
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const fetched = await fetchImageFromUrl(imageUrl!);
      buffer = fetched.buffer;
      sourceDomain = fetched.domain;
    }
    info = await inspectImage(buffer); // real MIME from magic bytes, size, dimensions
    [phash, metadata] = await Promise.all([perceptualHash(buffer), extractMetadata(buffer)]);
  } catch (error) {
    if (uploadPath) await discard(uploadPath); // never keep files that failed validation
    if (error instanceof ImageInputError) return fail(400, "invalid_image", error.message);
    console.error("[lookup] image read failed", error);
    return fail(400, "invalid_image", "We couldn't read that image.");
  }

  // ---- Store privately (24h) ---------------------------------------------------
  let storagePath: string;
  let expiresAt: string;
  if (uploadPath) {
    storagePath = uploadPath; // already in the private bucket
    const { data: row } = await admin.from("image_uploads").select("expires_at").eq("storage_path", uploadPath).single();
    expiresAt = row?.expires_at ?? new Date(Date.now() + IMAGE_RETENTION_HOURS * 3_600_000).toISOString();
  } else {
    storagePath = `${user.id}/${crypto.randomUUID()}.${EXT[info.mime]}`;
    expiresAt = new Date(Date.now() + IMAGE_RETENTION_HOURS * 3_600_000).toISOString();
    const upload = await admin.storage.from(IMAGE_BUCKET).upload(storagePath, buffer, {
      contentType: info.mime,
      upsert: false,
    });
    if (upload.error) {
      console.error("[lookup] storage upload failed", upload.error.message);
      return fail(500, "server_error", "Something went wrong. Please try again.");
    }
    await admin.from("image_uploads").insert({ storage_path: storagePath, expires_at: expiresAt });
  }

  // ---- Charge + create the lookup ------------------------------------------------
  const results: ImageResults = {
    image: {
      storagePath,
      mime: info.mime,
      width: info.width,
      height: info.height,
      bytes: buffer.length,
      source: imageUrl ? "url" : "upload",
      sourceDomain,
      expiresAt,
    },
    question: resolved.question ? { label: resolved.question.label, source: resolved.question.source } : null,
    metadata,
  };

  const { data, error } = await admin.rpc("start_lookup", {
    p_user_id: user.id,
    p_type: "image",
    p_query_hash: hashValue("image", phash),
    p_normalized_query: `phash:${phash}`,
    p_ip_hash: ipHash,
    p_raw_results: results as unknown as Json,
  });
  const started = data?.[0];
  if (error || !started?.lookup_id) {
    await discard(storagePath);
    if (started?.error === "banned") {
      return fail(403, "banned", "This account has been suspended for breaking the acceptable use policy.");
    }
    if (started?.error === "no_credits") {
      return fail(402, "no_credits", "You've used this month's free image lookups and have no credits left.");
    }
    console.error("[lookup] start_lookup failed", error?.message ?? started?.error);
    return fail(500, "server_error", "Something went wrong. Please try again.");
  }

  const lookupId = started.lookup_id;
  // Claim the upload for this lookup right away so it can't be reused.
  await admin.from("image_uploads").update({ lookup_id: lookupId }).eq("storage_path", storagePath);
  if (resolved.question) {
    await admin.from("lookups").update({ question: resolved.question.label }).eq("id", lookupId);
  }

  after(() =>
    runImagePipeline({
      lookupId,
      buffer,
      phash,
      results,
      question: resolved.question ? { label: resolved.question.label, guidance: resolved.question.guidance } : null,
    }),
  );

  return NextResponse.json({ id: lookupId });
}
