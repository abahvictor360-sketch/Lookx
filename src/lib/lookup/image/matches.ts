import type { ImageMatch, MatchGroup, MatchesSection } from "./types";

/**
 * Pure helpers for grouping reverse-image-search matches and deciding whether
 * an image looks like a "possible stolen photo".
 */

/** Sites where a photo usually stands for a person (profiles, dating, social). */
const PROFILE_SITES = [
  "instagram.com", "facebook.com", "fb.com", "tiktok.com", "twitter.com", "x.com", "linkedin.com",
  "threads.net", "snapchat.com", "pinterest.com", "reddit.com", "vk.com", "youtube.com",
  "tinder.com", "badoo.com", "bumble.com", "hinge.co", "okcupid.com", "match.com", "pof.com",
  "hi5.com", "tagged.com", "meetme.com", "twoo.com", "lovoo.com", "telegram.me", "t.me",
];

export function isProfileSite(domain: string) {
  return PROFILE_SITES.some((s) => domain === s || domain.endsWith(`.${s}`));
}

export function domainOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.replace(/^(www|m|mobile|web)\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The name/handle a profile page title refers to, e.g.
 * "Ada Obi (@ada.o) • Instagram photos and videos" -> "ada obi".
 */
export function profileIdentity(title: string): string | null {
  const head = title.split(/\s[•|·–—-]\s|\(|\s on (?:Instagram|Facebook|TikTok|X|Twitter)/i)[0]?.trim();
  if (!head || head.length < 2 || head.length > 60) return null;
  return head.toLowerCase().replace(/\s+/g, " ");
}

export function groupMatches(matches: ImageMatch[]): MatchGroup[] {
  const seen = new Set<string>();
  const byDomain = new Map<string, MatchGroup>();
  for (const m of matches) {
    const domain = domainOf(m.url);
    if (!domain || seen.has(m.url)) continue;
    seen.add(m.url);
    const group = byDomain.get(domain) ?? { domain, isProfileSite: isProfileSite(domain), matches: [] };
    group.matches.push(m);
    byDomain.set(domain, group);
  }
  // Profile sites first, then by number of matches.
  return [...byDomain.values()].sort(
    (a, b) => Number(b.isProfileSite) - Number(a.isProfileSite) || b.matches.length - a.matches.length,
  );
}

/**
 * Flag "possible stolen photo" when the same image is used by several
 * unrelated profiles, or is spread across many unrelated sites including at
 * least one profile site.
 */
export function assessStolen(groups: MatchGroup[]): MatchesSection["possibleStolen"] {
  const identities = new Set<string>();
  for (const g of groups.filter((g) => g.isProfileSite)) {
    for (const m of g.matches) {
      const id = profileIdentity(m.title);
      if (id) identities.add(id);
    }
  }
  if (identities.size >= 2) {
    return {
      flag: true,
      reason: `The same photo appears on ${identities.size} different profiles or names`,
    };
  }
  const profileDomains = groups.filter((g) => g.isProfileSite).length;
  if (groups.length >= 3 && profileDomains >= 1) {
    return {
      flag: true,
      reason: `The same photo appears on ${groups.length} unrelated websites, including social profiles`,
    };
  }
  return { flag: false, reason: null };
}
