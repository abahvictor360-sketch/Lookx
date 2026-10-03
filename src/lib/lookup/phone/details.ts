import "server-only";

// The "max" metadata includes number types (mobile / fixed line / VoIP), which
// the default "min" metadata used in the browser does not.
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { DEFAULT_COUNTRY } from "@/lib/lookup/detect";
import { nigerianNetworkFromPrefix } from "./carriers-ng";
import type { LineType, NumberDetails } from "./types";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function lineTypeFromPlan(type: string | undefined): LineType {
  switch (type) {
    case "MOBILE":
    case "FIXED_LINE_OR_MOBILE":
      return "mobile";
    case "FIXED_LINE":
      return "landline";
    case "VOIP":
      return "voip";
    case "TOLL_FREE":
      return "toll_free";
    case undefined:
      return "unknown";
    default:
      return "other";
  }
}

/**
 * Instant, offline number details (no network calls), so the results page can
 * show something immediately. Returns null for invalid numbers.
 */
export function getBasicNumberDetails(raw: string): NumberDetails | null {
  let input = raw.trim();
  if (/^234[\d\s-]{9,}$/.test(input.replace(/[()]/g, ""))) input = `+${input}`;
  if (input.startsWith("00")) input = `+${input.slice(2)}`;

  const parsed = parsePhoneNumberFromString(input, DEFAULT_COUNTRY);
  if (!parsed || !parsed.isValid()) return null;

  const country = parsed.country ?? null;
  const carrier = country === "NG" ? nigerianNetworkFromPrefix(parsed.nationalNumber) : null;

  return {
    e164: parsed.number,
    formatted: parsed.formatInternational(),
    national: parsed.formatNational(),
    country,
    countryName: country ? (countryNames.of(country) ?? country) : null,
    carrier,
    carrierSource: carrier ? "prefix" : null,
    lineType: lineTypeFromPlan(parsed.getType()),
    lineTypeSource: "numbering_plan",
  };
}
