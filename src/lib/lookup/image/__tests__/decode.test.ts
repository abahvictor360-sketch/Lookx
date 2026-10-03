import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { SAME_IMAGE_MAX_DISTANCE, hammingDistance, inspectImage, perceptualHash, sniffMime } from "../decode";

/** A synthetic "photo" with structure (gradient, shapes, text), rendered via SVG. */
function svgScene(variant: "a" | "b") {
  const shapes =
    variant === "a"
      ? `<circle cx="300" cy="260" r="140" fill="#e4572e"/><rect x="520" y="120" width="220" height="320" fill="#29335c"/><text x="80" y="560" font-size="64" fill="#fff">LookX</text>`
      : `<rect x="80" y="80" width="300" height="200" fill="#17bebb"/><polygon points="600,80 760,520 440,520" fill="#ffc914"/><circle cx="200" cy="480" r="90" fill="#76b041"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#8ecae6"/><stop offset="1" stop-color="#023047"/></linearGradient></defs>
      <rect width="800" height="600" fill="url(#g)"/>${shapes}</svg>`,
  );
}

const render = (v: "a" | "b") => sharp(svgScene(v)).jpeg({ quality: 92 }).toBuffer();

describe("sniffMime", () => {
  it("detects real types from magic bytes", async () => {
    const base = sharp(svgScene("a"));
    expect(sniffMime(await base.clone().jpeg().toBuffer())).toBe("image/jpeg");
    expect(sniffMime(await base.clone().png().toBuffer())).toBe("image/png");
    expect(sniffMime(await base.clone().webp().toBuffer())).toBe("image/webp");
  });
  it("rejects non-images and spoofed files", () => {
    expect(sniffMime(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(Buffer.from("GIF89a......"))).toBeNull();
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
  });
});

describe("inspectImage", () => {
  it("reads dimensions", async () => {
    expect(await inspectImage(await render("a"))).toMatchObject({ mime: "image/jpeg", width: 800, height: 600 });
  });
  it("rejects a text file renamed to .jpg", async () => {
    await expect(inspectImage(Buffer.from("not an image at all"))).rejects.toThrow(/JPG, PNG or WEBP/);
  });
});

describe("perceptualHash", () => {
  it("matches resized, re-compressed and converted copies", async () => {
    const original = await render("a");
    const h = await perceptualHash(original);
    expect(h).toMatch(/^[0-9a-f]{64}$/);

    const variants = await Promise.all([
      sharp(original).resize(400).jpeg({ quality: 60 }).toBuffer(),          // half size, heavy compression
      sharp(original).resize(1600).webp({ quality: 70 }).toBuffer(),         // upscaled, WEBP
      sharp(original).resize(320, 240).png().toBuffer(),                     // thumbnail, PNG
      sharp(original).jpeg({ quality: 35 }).toBuffer(),                      // WhatsApp-style recompression
    ]);
    for (const v of variants) {
      const d = hammingDistance(h, await perceptualHash(v));
      expect(d).toBeLessThanOrEqual(SAME_IMAGE_MAX_DISTANCE);
    }
  });

  it("does not match a different image", async () => {
    const d = hammingDistance(await perceptualHash(await render("a")), await perceptualHash(await render("b")));
    expect(d).toBeGreaterThan(SAME_IMAGE_MAX_DISTANCE * 2);
  });
});

describe("hammingDistance", () => {
  it("counts differing bits", () => {
    expect(hammingDistance("ff", "00")).toBe(8);
    expect(hammingDistance("a0", "a1")).toBe(1);
    expect(hammingDistance("ab", "abc")).toBe(Number.POSITIVE_INFINITY);
  });
});
