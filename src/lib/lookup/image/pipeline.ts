import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { scoreImage } from "@/lib/risk/image";
import { analyzeImage } from "@/lib/ai/analyze-image";
import { summarizeImageLookup } from "@/lib/ai/summarize-image";
import { getPublicReports } from "../reports";
import { SAME_IMAGE_MAX_DISTANCE, toVisionJpeg } from "./decode";
import { reverseImageSearch } from "./reverse-search";
import { cleanupExpiredImages, signedImageUrl } from "./storage";
import type { ImageResults } from "./types";

type Admin = ReturnType<typeof createAdminClient>;

async function merge(db: Admin, id: string, patch: Partial<ImageResults>) {
  const { error } = await db.rpc("merge_lookup_results", { p_id: id, p_patch: patch as Json });
  if (error) console.error("[lookup] merge failed", error.message);
}

/**
 * Runs after the POST response is sent. Sections are merged into raw_results
 * as they finish: reports + matches + authenticity (in parallel), then risk,
 * then the AI summary / answer.
 */
export async function runImagePipeline(args: {
  lookupId: string;
  buffer: Buffer;
  phash: string;
  results: ImageResults;
  question: { label: string; guidance: string | null } | null;
  /** Pro/Business "priority results": deeper analysis. */
  priority?: boolean;
}) {
  const { lookupId, buffer, phash, results, question, priority = false } = args;
  const db = createAdminClient();
  try {
    const [reports, matches, authenticity] = await Promise.all([
      // Match against known images (near-duplicates included) and load reports.
      (async () => {
        const { data, error } = await db.rpc("match_or_create_image", {
          p_hash: phash,
          p_max_distance: SAME_IMAGE_MAX_DISTANCE,
          p_storage_path: results.image.storagePath,
          p_expires_at: results.image.expiresAt,
        });
        if (error || !data?.[0]) throw error ?? new Error("match_or_create_image returned nothing");
        const imageId = data[0].image_id;
        await Promise.all([
          db.from("lookups").update({ image_id: imageId }).eq("id", lookupId),
          // First lookup of an upload claims it; re-runs reuse the same file.
          db.from("image_uploads").update({ image_id: imageId }).eq("storage_path", results.image.storagePath),
          db
            .from("image_uploads")
            .update({ lookup_id: lookupId })
            .eq("storage_path", results.image.storagePath)
            .is("lookup_id", null),
        ]);
        const r = await getPublicReports(db, "image", imageId);
        await merge(db, lookupId, { reports: r });
        return r;
      })(),
      // Reverse image search needs a publicly reachable URL: a 10-minute signed URL.
      (async () => {
        const url = await signedImageUrl(results.image.storagePath, 600);
        const m = url
          ? await reverseImageSearch(url)
          : { status: "error" as const, providers: [], total: 0, groups: [], possibleStolen: { flag: false, reason: null } };
        await merge(db, lookupId, { matches: m });
        return m;
      })(),
      (async () => {
        const a = await analyzeImage(await toVisionJpeg(buffer), results.metadata.software, priority);
        await merge(db, lookupId, { authenticity: a });
        return a;
      })(),
    ]);

    const risk = scoreImage({ matches, reports, authenticity });
    await merge(db, lookupId, { risk });

    const ai = await summarizeImageLookup({
      matches,
      reports,
      metadata: results.metadata,
      authenticity,
      risk,
      question,
      priority,
    });
    await merge(db, lookupId, { ai });

    await db
      .from("lookups")
      .update({ status: "complete", risk_level: risk.level, summary: ai.summary })
      .eq("id", lookupId);
  } catch (error) {
    console.error("[lookup] image pipeline failed", error);
    await db.from("lookups").update({ status: "failed" }).eq("id", lookupId);
  }

  // Opportunistic cleanup, in addition to the hourly cron.
  await cleanupExpiredImages(25).catch((e) => console.warn("[cleanup] failed", (e as Error).message));
}
