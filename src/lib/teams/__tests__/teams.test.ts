import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
beforeAll(() => {
  process.env.LOOKX_HASH_SECRET = "unit-test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
});

describe("API keys", () => {
  it("generates prefixed keys whose hash verifies and isn't the key", async () => {
    const { generateApiKey, hashApiKey } = await import("../server");
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).toMatch(/^lx_live_[A-Za-z0-9_-]{32}$/);
    expect(a.prefix).toBe(a.key.slice(0, 12));
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).not.toContain(a.key);
    expect(a.key).not.toBe(b.key);
  });
});

describe("csvCell", () => {
  it("quotes, escapes and neutralises spreadsheet formulas", async () => {
    const { csvCell } = await import("../bulk-read");
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+2348031234567")).toBe("\"'+2348031234567\"");
    expect(csvCell(null)).toBe('""');
    expect(csvCell(35)).toBe('"35"');
  });
});
