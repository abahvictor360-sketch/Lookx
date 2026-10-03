import { describe, expect, it } from "vitest";
import { levelForScore, scorePhone } from "../phone";
import { isScamText } from "../keywords";
import type { ReportsSection, WebSection, WebMention } from "@/lib/lookup/phone/types";

const noReports: ReportsSection = { total: 0, byCategory: {}, recentCount: 0, recent: [] };
const noWeb: WebSection = { status: "ok", provider: "serpapi", results: [] };
const mention = (flagged: boolean): WebMention => ({
  title: "t", snippet: "s", url: "https://x.com", domain: "x.com", date: null, flagged,
});

describe("levelForScore", () => {
  it("maps bands", () => {
    expect(levelForScore(0)).toBe("low");
    expect(levelForScore(29)).toBe("low");
    expect(levelForScore(30)).toBe("caution");
    expect(levelForScore(59)).toBe("caution");
    expect(levelForScore(60)).toBe("high");
    expect(levelForScore(100)).toBe("high");
  });
});

describe("scorePhone", () => {
  it("is low with no signals", () => {
    const r = scorePhone({ lineType: "mobile", reports: noReports, web: noWeb });
    expect(r).toMatchObject({ score: 0, level: "low", reasons: [] });
    expect(r.headline).toMatch(/No community reports/);
  });

  it("one scam report is caution", () => {
    const r = scorePhone({
      lineType: "mobile",
      reports: { ...noReports, total: 1, byCategory: { scam: 1 } },
      web: noWeb,
    });
    expect(r.level).toBe("caution");
    expect(r.score).toBe(35);
  });

  it("several recent scam reports + flagged web mentions is high", () => {
    const r = scorePhone({
      lineType: "mobile",
      reports: { ...noReports, total: 3, byCategory: { scam: 2, fake_vendor: 1 }, recentCount: 3 },
      web: { ...noWeb, results: [mention(true), mention(false)] },
    });
    expect(r.level).toBe("high");
    expect(r.reasons[0]).toMatch(/3 community reports describing scam, fake vendor/);
  });

  it("VoIP alone stays low", () => {
    const r = scorePhone({ lineType: "voip", reports: noReports, web: noWeb });
    expect(r.score).toBe(15);
    expect(r.level).toBe("low");
  });

  it("caps at 100", () => {
    const r = scorePhone({
      lineType: "voip",
      reports: { ...noReports, total: 10, byCategory: { scam: 8, spam: 2 }, recentCount: 10 },
      web: { ...noWeb, results: Array.from({ length: 5 }, () => mention(true)) },
    });
    expect(r.score).toBe(100);
  });
});

describe("isScamText", () => {
  it.each(["This guy is a SCAMMER", "419 alert", "Beware of this vendor", "don't pay before delivery", "fraudster"])(
    "flags %j", (t) => expect(isScamText(t)).toBe(true),
  );
  it.each(["Buy shoes in Lagos", "Contact us on WhatsApp", "Scampi recipe"])(
    "ignores %j", (t) => expect(isScamText(t)).toBe(false),
  );
});
