import type { LineType, ReportsSection, RiskSection, WebSection } from "@/lib/lookup/phone/types";
import type { ReportCategory, RiskLevel } from "@/lib/supabase/database.types";

/**
 * Phone risk indicator (0-100). Deterministic and explainable: every point
 * comes with a reason shown to the user. It is a risk indicator, not a verdict.
 *
 * Signals and weights:
 *  - Approved scam-type reports (scam, fake vendor, impersonation): strongest.
 *    35 for the first, +15 for each additional, max 70.
 *  - Other approved reports (spam, harassment): 8 each, max 20.
 *  - Web mentions with scam keywords: 10 each, max 30.
 *  - VoIP line: 15.
 *  - Cluster of recent reports (2+ in the last 14 days): 15.
 */

const SERIOUS: ReportCategory[] = ["scam", "fake_vendor", "impersonation"];

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  scam: "scam",
  fake_vendor: "fake vendor",
  spam: "spam",
  harassment: "harassment",
  impersonation: "impersonation",
};

export function levelForScore(score: number): RiskLevel {
  if (score >= 60) return "high";
  if (score >= 30) return "caution";
  return "low";
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function scorePhone(input: {
  lineType: LineType;
  reports: ReportsSection;
  web: WebSection;
}): RiskSection {
  const { reports, web } = input;
  const reasons: { points: number; text: string }[] = [];

  const serious = SERIOUS.reduce((n, c) => n + (reports.byCategory[c] ?? 0), 0);
  if (serious > 0) {
    const cats = SERIOUS.filter((c) => reports.byCategory[c]).map((c) => CATEGORY_LABEL[c]);
    reasons.push({
      points: Math.min(70, 35 + (serious - 1) * 15),
      text: `${plural(serious, "community report")} describing ${cats.join(", ")}`,
    });
  }

  const minor = reports.total - serious;
  if (minor > 0) {
    reasons.push({
      points: Math.min(20, minor * 8),
      text: `${plural(minor, "community report")} of spam or harassment`,
    });
  }

  const flagged = web.results.filter((r) => r.flagged).length;
  if (flagged > 0) {
    reasons.push({
      points: Math.min(30, flagged * 10),
      text: `${plural(flagged, "web mention")} with scam-related words`,
    });
  }

  if (input.lineType === "voip") {
    reasons.push({ points: 15, text: "VoIP (internet) number, which is easy to create and discard" });
  }

  if (reports.recentCount >= 2) {
    reasons.push({ points: 15, text: `${reports.recentCount} reports in the last 14 days` });
  }

  const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
  const level = levelForScore(score);
  reasons.sort((a, b) => b.points - a.points);

  const headline =
    reasons[0]?.text ??
    (web.status === "ok"
      ? "No community reports or warning signs found"
      : "No community reports found (web search unavailable)");

  return {
    score,
    level,
    headline: headline.charAt(0).toUpperCase() + headline.slice(1),
    reasons: reasons.map((r) => r.text),
  };
}
