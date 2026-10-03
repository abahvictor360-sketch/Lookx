import type { PhoneResults } from "@/lib/lookup/phone/types";
import type { LookupStatus, RiskLevel } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/public-env";

/** Stable, documented JSON shape for API v1 phone results. */
export function serializePhoneLookup(row: {
  id: string;
  status: LookupStatus;
  risk_level: RiskLevel | null;
  created_at: string;
  raw_results: unknown;
}) {
  const r = row.raw_results as PhoneResults;
  return {
    id: row.id,
    type: "phone" as const,
    status: row.status,
    created_at: row.created_at,
    result_url: `${publicEnv.siteUrl.replace(/\/$/, "")}/result/${row.id}`,
    number: {
      e164: r.number.e164,
      formatted: r.number.formatted,
      country: r.number.country,
      network: r.number.carrier,
      network_source: r.number.carrierSource,
      line_type: r.number.lineType,
    },
    risk: r.risk
      ? { level: r.risk.level, score: r.risk.score, headline: r.risk.headline, reasons: r.risk.reasons, disclaimer: "Risk indicator, not a verdict." }
      : null,
    summary: r.ai?.summary ?? null,
    reports: r.reports
      ? { total: r.reports.total, disputed: r.reports.disputedCount ?? 0, by_category: r.reports.byCategory, recent_14_days: r.reports.recentCount }
      : null,
    web_mentions: r.web
      ? {
          status: r.web.status,
          results: r.web.results.map((m) => ({ title: m.title, url: m.url, domain: m.domain, date: m.date, scam_keywords: m.flagged })),
        }
      : null,
  };
}
