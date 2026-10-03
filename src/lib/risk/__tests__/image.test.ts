import { describe, expect, it } from "vitest";
import { scoreImage } from "../image";
import type { AuthenticitySection, MatchesSection } from "@/lib/lookup/image/types";
import type { ReportsSection } from "@/lib/lookup/phone/types";

const noReports: ReportsSection = { total: 0, byCategory: {}, recentCount: 0, recent: [] };
const noMatches: MatchesSection = { status: "ok", providers: ["google_lens"], total: 0, groups: [], possibleStolen: { flag: false, reason: null } };
const auth = (ai: "low" | "medium" | "high" = "low", stock: "low" | "medium" | "high" = "low"): AuthenticitySection => ({
  status: "ok",
  aiGenerated: { level: ai, note: "" },
  edited: { level: "low", note: "" },
  stockOrCatalog: { level: stock, note: "" },
  visibleText: [],
});

describe("scoreImage", () => {
  it("is low with no signals", () => {
    expect(scoreImage({ matches: noMatches, reports: noReports, authenticity: auth() })).toMatchObject({ score: 0, level: "low" });
  });
  it("stolen photo alone is caution", () => {
    const r = scoreImage({
      matches: { ...noMatches, possibleStolen: { flag: true, reason: "The same photo appears on 3 different profiles or names" } },
      reports: noReports,
      authenticity: auth(),
    });
    expect(r.level).toBe("caution");
    expect(r.headline).toMatch(/^Possible stolen photo/);
  });
  it("stolen + report is high", () => {
    const r = scoreImage({
      matches: { ...noMatches, possibleStolen: { flag: true, reason: "x" } },
      reports: { ...noReports, total: 1, byCategory: { impersonation: 1 } },
      authenticity: auth(),
    });
    expect(r.level).toBe("high");
  });
  it("AI-generated + stock adds moderate weight", () => {
    const r = scoreImage({ matches: noMatches, reports: noReports, authenticity: auth("high", "high") });
    expect(r.score).toBe(45);
    expect(r.level).toBe("caution");
  });
});
