import type { ReportsSection, RiskSection } from "@/lib/lookup/phone/types";
import type { AuthenticitySection, MatchesSection } from "@/lib/lookup/image/types";
import type { ReportCategory } from "@/lib/supabase/database.types";
import { CATEGORY_LABEL, levelForScore } from "./phone";

/**
 * Image risk indicator (0-100), explainable like the phone score.
 *  - Same photo on multiple unrelated profiles/sites: strong, 40
 *  - Approved scam-type reports: 35 for the first, +15 each, max 70
 *  - Other approved reports: 8 each, max 20
 *  - AI-generated likelihood: high 25, medium 10
 *  - Stock / catalog photo: high 20, medium 8
 */
const SERIOUS: ReportCategory[] = ["scam", "fake_vendor", "impersonation"];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function scoreImage(input: {
  matches: MatchesSection;
  reports: ReportsSection;
  authenticity: AuthenticitySection;
}): RiskSection {
  const { matches, reports, authenticity } = input;
  const reasons: { points: number; text: string }[] = [];

  if (matches.possibleStolen.flag && matches.possibleStolen.reason) {
    reasons.push({ points: 40, text: `Possible stolen photo: ${matches.possibleStolen.reason.charAt(0).toLowerCase()}${matches.possibleStolen.reason.slice(1)}` });
  }

  const serious = SERIOUS.reduce((n, c) => n + (reports.byCategory[c] ?? 0), 0);
  if (serious > 0) {
    const cats = SERIOUS.filter((c) => reports.byCategory[c]).map((c) => CATEGORY_LABEL[c]);
    reasons.push({ points: Math.min(70, 35 + (serious - 1) * 15), text: `${plural(serious, "community report")} describing ${cats.join(", ")}` });
  }
  const minor = reports.total - serious;
  if (minor > 0) {
    reasons.push({ points: Math.min(20, minor * 8), text: `${plural(minor, "community report")} of spam or harassment` });
  }

  const ai = authenticity.aiGenerated.level;
  if (ai === "high") reasons.push({ points: 25, text: "Strong signs the image is AI-generated" });
  else if (ai === "medium") reasons.push({ points: 10, text: "Some signs the image may be AI-generated" });

  const stock = authenticity.stockOrCatalog.level;
  if (stock === "high") reasons.push({ points: 20, text: "Looks like a stock, model or catalog photo" });
  else if (stock === "medium") reasons.push({ points: 8, text: "May be a stock, model or catalog photo" });

  const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
  reasons.sort((a, b) => b.points - a.points);
  const headline =
    reasons[0]?.text ??
    (matches.status === "ok"
      ? "No reports or warning signs found for this image"
      : "No reports found (reverse image search unavailable)");

  return { score, level: levelForScore(score), headline, reasons: reasons.map((r) => r.text) };
}
