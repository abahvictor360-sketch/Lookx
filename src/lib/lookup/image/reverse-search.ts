import "server-only";

import { serverEnv } from "@/lib/env";
import { assessStolen, groupMatches } from "./matches";
import type { ImageMatch, MatchesSection } from "./types";

const TIMEOUT_MS = 9000;
const MAX_MATCHES = 40;

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/<[^>]*>/g, "").trim().slice(0, max) : "";

/**
 * Google Lens via SerpAPI, EXACT matches only: pages that contain this same
 * image. We deliberately don't use "visual matches" (similar-looking images),
 * which for photos of people amounts to face matching.
 */
async function googleLens(imageUrl: string, key: string): Promise<ImageMatch[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_lens");
  url.searchParams.set("type", "exact_matches");
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("hl", "en");
  url.searchParams.set("country", "ng");
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`SerpAPI Lens ${res.status}`);
  const data = (await res.json()) as {
    exact_matches?: { title?: string; link?: string; date?: string }[];
  };
  return (data.exact_matches ?? [])
    .filter((m) => typeof m.link === "string")
    .map((m) => ({ title: clean(m.title, 200) || m.link!, url: m.link!, date: clean(m.date, 40) || null }));
}

/** TinEye (optional second source). */
async function tinEye(imageUrl: string, key: string): Promise<ImageMatch[]> {
  const url = new URL("https://api.tineye.com/rest/search/");
  url.searchParams.set("image_url", imageUrl);
  url.searchParams.set("limit", "30");
  const res = await fetch(url, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TinEye ${res.status}`);
  const data = (await res.json()) as {
    results?: { matches?: { backlinks?: { backlink?: string; url?: string; crawl_date?: string }[] }[] };
  };
  const out: ImageMatch[] = [];
  for (const m of data.results?.matches ?? []) {
    for (const b of m.backlinks ?? []) {
      if (typeof b.backlink === "string") {
        out.push({ title: b.backlink, url: b.backlink, date: clean(b.crawl_date, 40) || null });
      }
    }
  }
  return out;
}

/** imageUrl must be publicly reachable (a short-lived signed URL). */
export async function reverseImageSearch(imageUrl: string): Promise<MatchesSection> {
  const sources = [
    { name: "google_lens" as const, key: serverEnv.serpApiKey(), run: googleLens },
    { name: "tineye" as const, key: serverEnv.tineyeApiKey(), run: tinEye },
  ].filter((s) => s.key);

  const empty = { total: 0, groups: [], possibleStolen: { flag: false, reason: null } };
  if (sources.length === 0) return { status: "not_configured", providers: [], ...empty };

  const settled = await Promise.allSettled(sources.map((s) => s.run(imageUrl, s.key!)));
  const providers: MatchesSection["providers"] = [];
  const matches: ImageMatch[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      providers.push(sources[i].name);
      matches.push(...r.value);
    } else {
      console.warn(`[lookup] ${sources[i].name} failed`, (r.reason as Error).message);
    }
  });
  if (providers.length === 0) return { status: "error", providers, ...empty };

  const groups = groupMatches(matches.slice(0, MAX_MATCHES * 2));
  let count = 0;
  const capped = groups
    .map((g) => ({ ...g, matches: g.matches.filter(() => count++ < MAX_MATCHES) }))
    .filter((g) => g.matches.length > 0);

  return {
    status: "ok",
    providers,
    total: capped.reduce((n, g) => n + g.matches.length, 0),
    groups: capped,
    possibleStolen: assessStolen(capped),
  };
}
