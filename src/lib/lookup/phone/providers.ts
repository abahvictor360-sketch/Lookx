import "server-only";

import { serverEnv } from "@/lib/env";
import type { LineType, NumberDetails } from "./types";

/**
 * Carrier / line-type enrichment. Abstract API first, Twilio Lookup v2 as a
 * fallback. Both are optional: with no keys we keep the offline details.
 */

const TIMEOUT_MS = 4000;

type Enrichment = Pick<NumberDetails, "carrier" | "carrierSource" | "lineType" | "lineTypeSource">;

function normaliseLineType(type: string | null | undefined): LineType {
  const t = (type ?? "").toLowerCase();
  if (!t) return "unknown";
  if (t.includes("voip")) return "voip";
  if (t.includes("mobile") || t.includes("wireless")) return "mobile";
  if (t.includes("landline") || t.includes("fixed")) return "landline";
  if (t.includes("toll")) return "toll_free";
  return "other";
}

async function fromAbstract(e164: string): Promise<Enrichment | null> {
  const key = serverEnv.abstractPhoneApiKey();
  if (!key) return null;
  const url = new URL("https://phonevalidation.abstractapi.com/v1/");
  url.searchParams.set("api_key", key);
  url.searchParams.set("phone", e164.replace("+", ""));

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`Abstract API ${res.status}`);
  const data = (await res.json()) as { valid?: boolean; type?: string; carrier?: string };
  if (!data.valid) return null;
  return {
    carrier: data.carrier || null,
    carrierSource: data.carrier ? "abstract" : null,
    lineType: normaliseLineType(data.type),
    lineTypeSource: "abstract",
  };
}

async function fromTwilio(e164: string): Promise<Enrichment | null> {
  const sid = serverEnv.twilioAccountSid();
  const token = serverEnv.twilioAuthToken();
  if (!sid || !token) return null;

  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}`);
  const data = (await res.json()) as {
    valid?: boolean;
    line_type_intelligence?: { carrier_name?: string | null; type?: string | null } | null;
  };
  const lti = data.line_type_intelligence;
  if (!lti) return null;
  return {
    carrier: lti.carrier_name || null,
    carrierSource: lti.carrier_name ? "twilio" : null,
    lineType: normaliseLineType(lti.type),
    lineTypeSource: "twilio",
  };
}

/** Returns details refined by the first provider that answers, else the input. */
export async function enrichNumberDetails(details: NumberDetails): Promise<NumberDetails> {
  for (const provider of [fromAbstract, fromTwilio]) {
    try {
      const result = await provider(details.e164);
      if (result) {
        return {
          ...details,
          lineType: result.lineType !== "unknown" ? result.lineType : details.lineType,
          lineTypeSource: result.lineType !== "unknown" ? result.lineTypeSource : details.lineTypeSource,
          // Keep the prefix-based network if the provider didn't name a carrier.
          carrier: result.carrier ?? details.carrier,
          carrierSource: result.carrier ? result.carrierSource : details.carrierSource,
        };
      }
    } catch (error) {
      console.warn("[lookup] carrier provider failed", (error as Error).message);
    }
  }
  return details;
}
