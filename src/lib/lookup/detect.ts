import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Input detection for the hero search box. Shared by client and server so the
 * same rules apply everywhere. Nigeria (+234) is the default region.
 */

export const DEFAULT_COUNTRY: CountryCode = "NG";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

export type DetectedInput =
  | { kind: "empty" }
  | { kind: "phone"; e164: string; formatted: string; country?: string }
  | { kind: "invalid_phone"; message: string }
  | { kind: "image_url"; url: string }
  | { kind: "person_query"; message: string }
  | { kind: "unknown"; message: string };

const FACE_ID_MESSAGE =
  "LookX can't identify who a person is. We show where an image appears online, not who a face belongs to. Upload the photo to see where else it's been posted.";

/**
 * Normalise a phone number in any common format to E.164.
 * Accepts 08012345678, +2348012345678, 234 801 234 5678, etc.
 */
export function normalizePhone(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY) {
  let input = raw.trim();
  // "234 801..." without a plus is very common in Nigeria; treat it as international.
  if (/^234[\d\s-]{9,}$/.test(input.replace(/[()]/g, ""))) input = `+${input}`;
  if (input.startsWith("00")) input = `+${input.slice(2)}`;

  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;

  return {
    e164: parsed.number as string,
    formatted: parsed.formatInternational(),
    national: parsed.formatNational(),
    country: parsed.country,
  };
}

/** Very small heuristic: does this text look like it's mostly a phone number? */
function looksLikePhone(text: string) {
  const digits = text.replace(/\D/g, "");
  return /^[+\d\s().-]+$/.test(text) && digits.length >= 7;
}

function looksLikeImageUrl(text: string) {
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Phrases that suggest the user wants to identify a person. */
const PERSON_QUERY = /\b(who is|who's|identify|find (this|the) person|whose face|name of (this|the) (person|girl|guy|man|woman))\b/i;

export function detectInput(raw: string): DetectedInput {
  const text = raw.trim();
  if (!text) return { kind: "empty" };

  if (looksLikeImageUrl(text)) return { kind: "image_url", url: text };

  if (looksLikePhone(text)) {
    const phone = normalizePhone(text);
    if (!phone) {
      return {
        kind: "invalid_phone",
        message:
          "That doesn't look like a valid phone number. Try a format like 08012345678 or +2348012345678.",
      };
    }
    return { kind: "phone", e164: phone.e164, formatted: phone.formatted, country: phone.country };
  }

  if (PERSON_QUERY.test(text)) return { kind: "person_query", message: FACE_ID_MESSAGE };

  return {
    kind: "unknown",
    message: "Enter a phone number, paste an image link, or upload a photo.",
  };
}

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Please upload a JPG, PNG or WEBP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 10MB or smaller.";
  return null;
}
