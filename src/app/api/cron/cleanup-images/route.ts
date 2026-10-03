import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cleanupExpiredImages } from "@/lib/lookup/image/storage";

/**
 * GET /api/cron/cleanup-images
 * Deletes uploaded images older than 24 hours. Called hourly by Vercel Cron
 * (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authorised =
    Boolean(secret) &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!authorised) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let deleted = 0;
  // Drain in batches, bounded so one run can't exceed the function timeout.
  for (let i = 0; i < 10; i++) {
    const n = await cleanupExpiredImages(100);
    deleted += n;
    if (n < 100) break;
  }
  return NextResponse.json({ deleted });
}
