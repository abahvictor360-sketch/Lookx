import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_unit";
});

describe("isValidWebhookSignature", () => {
  it("accepts Paystack's HMAC-SHA512 of the raw body and rejects anything else", async () => {
    const { isValidWebhookSignature } = await import("../paystack");
    const body = JSON.stringify({ event: "charge.success", data: { reference: "lx_starter_x" } });
    const good = createHmac("sha512", "sk_test_unit").update(body).digest("hex");
    expect(isValidWebhookSignature(body, good)).toBe(true);
    expect(isValidWebhookSignature(body, null)).toBe(false);
    expect(isValidWebhookSignature(body, "abc")).toBe(false);
    expect(isValidWebhookSignature(body + " ", good)).toBe(false); // tampered body
    const wrongKey = createHmac("sha512", "sk_other").update(body).digest("hex");
    expect(isValidWebhookSignature(body, wrongKey)).toBe(false);
  });

  it("reads plan codes in both shapes", async () => {
    const { planCodeOf } = await import("../paystack");
    expect(planCodeOf({ plan: "PLN_1" })).toBe("PLN_1");
    expect(planCodeOf({ plan: { plan_code: "PLN_2" } })).toBe("PLN_2");
    expect(planCodeOf({ plan: null })).toBeNull();
  });
});

describe("plans", () => {
  it("treats expired Pro as not Pro", async () => {
    const { effectivePlan, isProActive } = await import("@/lib/plans");
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isProActive({ plan: "pro", plan_expires_at: future })).toBe(true);
    expect(isProActive({ plan: "pro", plan_expires_at: past })).toBe(false);
    expect(effectivePlan({ plan: "pro", plan_expires_at: past, credits: 3 })).toBe("starter");
    expect(effectivePlan({ plan: "pro", plan_expires_at: past, credits: 0 })).toBe("free");
    expect(effectivePlan({ plan: "business", plan_expires_at: null, credits: 0 })).toBe("business");
  });
  it("formats naira from kobo", async () => {
    const { formatNaira } = await import("@/lib/plans");
    expect(formatNaira(200_000)).toMatch(/2,000/);
  });
});
