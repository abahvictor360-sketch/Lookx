import "server-only";

import { serverEnv } from "@/lib/env";
import { isScamText } from "@/lib/risk/keywords";
import type { NumberDetails, WebMention, WebSection } from "./types";

const TIMEOUT_MS = 6000;
const MAX_RESULTS = 20;

/** The common ways a number is written online, e.g. for +2348031234567. */
export function phoneQueryFormats(details: Pick<NumberDetails, "e164" | "national">) {
  const digits = details.e164.replace("+", "");
  const nationalDigits = details.national.replace(/\D/g, "");
  return Array.from(
    new Set([nationalDigits, details.e164, digits, details.national]),
  ).filter(Boolean);
}

export function buildSearchQuery(details: Pick<NumberDetails, "e164" | "national">) {
  return phoneQueryFormats(details).map((f) => `"${f}"`).join(" OR ");
}

function stripHtml(text: string) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function toMention(title: string, snippet: string, url: string, date: string | null): WebMention | null {
  let domain: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const cleanTitle = stripHtml(title).slice(0, 200);
  const cleanSnippet = stripHtml(snippet).slice(0, 400);
  return {
    title: cleanTitle,
    snippet: cleanSnippet,
    url,
    domain,
    date,
    flagged: isScamText(`${cleanTitle} ${cleanSnippet}`),
  };
}

async function searchSerpApi(query: string, key: string): Promise<WebMention[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", "ng");
  url.searchParams.set("hl", "en");
  url.searchParams.set("num", String(MAX_RESULTS));
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const data = (await res.json()) as {
    organic_results?: { title?: string; link?: string; snippet?: string; date?: string }[];
  };
  return (data.organic_results ?? [])
    .map((r) => (r.link ? toMention(r.title ?? r.link, r.snippet ?? "", r.link, r.date ?? null) : null))
    .filter((m): m is WebMention => m !== null);
}

async function searchBrave(query: string, key: string): Promise<WebMention[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(MAX_RESULTS));

  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const data = (await res.json()) as {
    web?: { results?: { title?: string; url?: string; description?: string; age?: string; page_age?: string }[] };
  };
  return (data.web?.results ?? [])
    .map((r) =>
      r.url ? toMention(r.title ?? r.url, r.description ?? "", r.url, r.age ?? r.page_age ?? null) : null,
    )
    .filter((m): m is WebMention => m !== null);
}

/** Search the public web for the number. SerpAPI first, Brave as a fallback. */
export async function searchWebForNumber(details: NumberDetails): Promise<WebSection> {
  const query = buildSearchQuery(details);
  const providers = [
    { name: "serpapi" as const, key: serverEnv.serpApiKey(), run: searchSerpApi },
    { name: "brave" as const, key: serverEnv.braveSearchApiKey(), run: searchBrave },
  ].filter((p) => p.key);

  if (providers.length === 0) return { status: "not_configured", provider: null, results: [] };

  for (const provider of providers) {
    try {
      const results = await provider.run(query, provider.key!);
      // De-duplicate by URL, keep order.
      const seen = new Set<string>();
      const unique = results.filter((r) => !seen.has(r.url) && seen.add(r.url));
      return { status: "ok", provider: provider.name, results: unique.slice(0, MAX_RESULTS) };
    } catch (error) {
      console.warn(`[lookup] ${provider.name} search failed`, (error as Error).message);
    }
  }
  return { status: "error", provider: null, results: [] };
}
