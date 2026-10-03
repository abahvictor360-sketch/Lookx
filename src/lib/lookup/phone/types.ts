import type { ReportCategory, ReportPlatform, RiskLevel } from "@/lib/supabase/database.types";

/** Normalised line types across libphonenumber, Abstract and Twilio. */
export type LineType = "mobile" | "landline" | "voip" | "toll_free" | "other" | "unknown";

export type NumberDetails = {
  e164: string;
  formatted: string;
  national: string;
  country: string | null; // ISO code, e.g. "NG"
  countryName: string | null;
  carrier: string | null;
  /** Where the carrier came from. "prefix" = original allocation, may be ported. */
  carrierSource: "abstract" | "twilio" | "prefix" | null;
  lineType: LineType;
  lineTypeSource: "abstract" | "twilio" | "numbering_plan";
};

export type WebMention = {
  title: string;
  snippet: string;
  url: string;
  domain: string;
  date: string | null;
  /** Title/snippet contains a scam-related keyword. */
  flagged: boolean;
};

export type WebSection = {
  status: "ok" | "not_configured" | "error";
  provider: "serpapi" | "brave" | null;
  results: WebMention[];
};

export type ReportsSection = {
  total: number;
  byCategory: Partial<Record<ReportCategory, number>>;
  /** Public reports in the last 14 days. */
  recentCount: number;
  /** Reports the number/image owner has disputed (still shown, under review). */
  disputedCount?: number;
  recent: {
    category: ReportCategory;
    platform: ReportPlatform;
    excerpt: string;
    created_at: string;
    disputed?: boolean;
  }[];
};

export type RiskSection = {
  score: number;
  level: RiskLevel;
  /** One-line reason shown next to the badge. */
  headline: string;
  reasons: string[];
};

export type AiSection = {
  status: "ok" | "not_configured" | "error";
  summary: string;
  risk_reasons: string[];
  source_count: number;
};

/** Shape of lookups.raw_results for phone lookups. Sections appear as they finish. */
export type PhoneResults = {
  number: NumberDetails;
  web?: WebSection;
  reports?: ReportsSection;
  risk?: RiskSection;
  ai?: AiSection;
};
