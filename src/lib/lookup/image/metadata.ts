import "server-only";

import exifr from "exifr";
import type { ImageMetadata } from "./types";

/**
 * Camera, date taken and editing software from EXIF/XMP. GPS is only reported
 * as present/absent: coordinates are never stored or shown, because LookX
 * must not be usable to locate people.
 */
export async function extractMetadata(buf: Buffer): Promise<ImageMetadata> {
  const empty: ImageMetadata = { found: false, camera: null, takenAt: null, software: null, hasGps: false };
  let tags: Record<string, unknown> | undefined;
  try {
    tags = await exifr.parse(buf, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      icc: false,
      iptc: false,
      pick: ["Make", "Model", "DateTimeOriginal", "CreateDate", "Software", "CreatorTool", "GPSLatitude", "GPSLongitude", "latitude"],
    });
  } catch {
    return empty;
  }
  if (!tags) return empty;

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
  const make = str(tags.Make);
  const model = str(tags.Model);
  const camera = make && model && !model.toLowerCase().startsWith(make.toLowerCase())
    ? `${make} ${model}`
    : (model ?? make);
  const dateRaw = tags.DateTimeOriginal ?? tags.CreateDate;
  const takenAt = dateRaw instanceof Date && !Number.isNaN(dateRaw.getTime()) ? dateRaw.toISOString() : null;
  const software = str(tags.Software) ?? str(tags.CreatorTool);
  const hasGps = tags.GPSLatitude != null || tags.latitude != null;

  return { found: Boolean(camera || takenAt || software || hasGps), camera, takenAt, software, hasGps };
}
