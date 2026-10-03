import type { Plan } from "@/lib/supabase/database.types";

/**
 * Plan definitions shown in the UI.
 * Allowances are ENFORCED in SQL (public.start_lookup); keep the two in sync.
 * Paid credits never expire; each lookup uses one once allowances run out.
 */
export const GUEST_PHONE_LOOKUPS_PER_DAY = 2;

export const PLANS: Record<
  Plan,
  { name: string; priceNgn: number | null; monthly: { phone: number; image: number } | { any: number } }
> = {
  free: { name: "Free", priceNgn: 0, monthly: { phone: 5, image: 3 } },
  starter: { name: "Starter", priceNgn: 2000, monthly: { phone: 5, image: 3 } }, // + 30 credits
  pro: { name: "Pro", priceNgn: 5000, monthly: { any: 150 } },
  business: { name: "Business", priceNgn: null, monthly: { any: 150 } },
};
