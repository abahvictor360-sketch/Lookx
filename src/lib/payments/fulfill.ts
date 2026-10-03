import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { planCodeOf, verifyTransaction } from "./paystack";

export type FulfillResult =
  | { status: "applied" | "already_applied"; product: "starter" | "pro" | null }
  | { status: "not_paid" | "unknown" | "mismatch" };

/**
 * Verify a reference with Paystack, then apply it exactly once.
 * Shared by the webhook and the client-side verify route.
 */
export async function fulfillReference(reference: string): Promise<FulfillResult> {
  const tx = await verifyTransaction(reference);
  if (tx.status !== "success") return { status: "not_paid" };

  const db = createAdminClient();
  const customer = tx.customer?.customer_code ?? null;
  const { data } = await db.rpc("fulfill_payment", {
    p_reference: tx.reference,
    p_amount: tx.amount,
    p_currency: tx.currency,
    p_customer_code: customer,
  });
  const r = data?.[0];
  if (r?.ok) return { status: r.already_applied ? "already_applied" : "applied", product: r.product };
  if (r?.user_id) return { status: "mismatch" };

  // Not one of ours: a Pro auto-renewal charged by Paystack's subscription engine.
  const proPlan = serverEnv.paystackProPlanCode();
  if (proPlan && planCodeOf(tx) === proPlan && customer) {
    const { data: renewal } = await db.rpc("record_pro_renewal", {
      p_reference: tx.reference,
      p_amount: tx.amount,
      p_currency: tx.currency,
      p_customer_code: customer,
    });
    const rr = renewal?.[0];
    if (rr?.ok) return { status: rr.already_applied ? "already_applied" : "applied", product: "pro" };
  }
  return { status: "unknown" };
}
