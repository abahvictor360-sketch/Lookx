import sharp, { type Metadata } from "sharp";
import { bmvbhash } from "blockhash-core";
import { MAX_IMAGE_BYTES } from "@/lib/lookup/detect";

/**
 * Image decoding, MIME sniffing and perceptual hashing (server-only by usage:
 * sharp is a native module).
 */

export type SupportedMime = "image/jpeg" | "image/png" | "image/webp";

/** Identify the real file type from its first bytes. Never trust the client's type. */
export function sniffMime(buf: Uint8Array): SupportedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) === "RIFF" &&
    String.fromCharCode(buf[8], buf[9], buf[10], buf[11]) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export class ImageInputError extends Error {}

/** Validate size + real type and read dimensions. Throws ImageInputError. */
export async function inspectImage(buf: Buffer) {
  if (buf.length === 0) throw new ImageInputError("The image is empty.");
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageInputError("Images must be 10MB or smaller.");
  const mime = sniffMime(buf);
  if (!mime) throw new ImageInputError("Please upload a JPG, PNG or WEBP image.");

  let meta: Metadata;
  try {
    // limitInputPixels guards against decompression bombs.
    meta = await sharp(buf, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new ImageInputError("We couldn't read that image. It may be damaged.");
  }
  if (!meta.width || !meta.height) throw new ImageInputError("We couldn't read that image.");
  return { mime, width: meta.width, height: meta.height };
}

/**
 * 256-bit blockhash of the image, as 64 hex chars. Normalising to a fixed
 * greyscale size first makes the hash stable across resizing, re-compression
 * and format changes, so re-uploads of a reported image still match.
 */
export async function perceptualHash(buf: Buffer): Promise<string> {
  const { data, info } = await sharp(buf, { limitInputPixels: 50_000_000 })
    .rotate() // respect EXIF orientation
    .flatten({ background: "#ffffff" })
    .resize(256, 256, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return bmvbhash({ width: info.width, height: info.height, data }, 16);
}

/** Number of differing bits between two hex hashes of equal length. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Max differing bits (of 256) for two images to count as the same picture. */
export const SAME_IMAGE_MAX_DISTANCE = 16;

/** Downscaled JPEG for the vision model (keeps tokens and latency down). */
export async function toVisionJpeg(buf: Buffer) {
  return sharp(buf, { limitInputPixels: 50_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}
