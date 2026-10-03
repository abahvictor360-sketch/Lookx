import { NextResponse } from "next/server";

/**
 * POST /api/lookup/image
 * Placeholder until Phase 3 (upload, reverse image search, EXIF, AI checks).
 */
export async function POST() {
  return NextResponse.json({ error: "Image lookups aren't live yet." }, { status: 501 });
}
