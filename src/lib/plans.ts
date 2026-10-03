import type { Plan, Profile } from "@/lib/supabase/database.types";

/**
 * Plans and prices. Allowances are ENFORCED in SQL (public.start_lookup) and
 * payments applied in public.fulfill_payment; keep the numbers in sync.
 * Paid credits never expire; each lookup uses one once allowances run out.
 */
export const GUEST_PHONE_LOOKUPS_PER_DAY = 2;
export const FREE_MONTHLY = { phone: 5, image: 3 } as const;
export const PRO_MONTHLY_LOOKUPS = 150;

export type Product = "starter" | "pro";

/** Amounts in kobo (NGN x 100), as Paystack expects. */
export const PRODUCTS: Record<Product, { name: string; amountKobo: number; credits: number; description: string }> = {
  starter: { name: "Starter", amountKobo: 200_000, credits: 30, description: "30 lookups that never expire" },
  pro: { name: "Pro", amountKobo: 500_000, credits: 0, description: "150 lookups a month, priority results, full history" },
};

export const formatNaira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);

/** Pro is active only until plan_expires_at. */
export function isProActive(profile: Pick<Profile, "plan" | "plan_expires_at"> | null | undefined) {
  return Boolean(
    profile && profile.plan === "pro" && profile.plan_expires_at && Date.parse(profile.plan_expires_at) > Date.now(),
  );
}

/** Plan to show in the UI (an expired Pro shows as Free/Starter). */
export function effectivePlan(profile: Pick<Profile, "plan" | "plan_expires_at" | "credits"> | null | undefined): Plan {
  if (!profile) return "free";
  if (profile.plan === "business") return "business";
  if (isProActive(profile)) return "pro";
  return profile.plan === "starter" || profile.credits > 0 ? "starter" : "free";
}

export const PLAN_LABEL: Record<Plan, string> = { free: "Free", starter: "Starter", pro: "Pro", business: "Business" };

/** Free and Starter users see the last 30 days of history; Pro and Business see everything. */
export const FREE_HISTORY_DAYS = 30;
