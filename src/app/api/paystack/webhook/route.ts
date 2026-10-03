import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillReference } from "@/lib/payments/fulfill";
import { isValidWebhookSignature } from "@/lib/payments/paystack";

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    subscription_code?: string;
    customer?: { customer_code?: string };
  };
};

/**
 * POST /api/paystack/webhook
 * - Rejects anything without a valid x-paystack-signature (HMAC-SHA512).
 * - charge.success: re-verifies with Paystack's API, then applies once.
 *   Duplicate deliveries are no-ops (fulfill_payment is idempotent).
 * - subscription.create / disable / not_renew: tracks the Pro subscription.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!isValidWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  try {
    const customer = event.data?.customer?.customer_code;
    switch (event.event) {
      case "charge.success": {
        const reference = event.data?.reference;
        if (reference) {
          const r = await fulfillReference(reference);
          if (r.status === "mismatch" || r.status === "unknown") {
            console.warn("[paystack] charge.success not applied", reference, r.status);
          }
        }
        break;
      }
      case "subscription.create":
        if (customer && event.data?.subscription_code) {
          await createAdminClient()
            .from("profiles")
            .update({ paystack_subscription_code: event.data.subscription_code })
            .eq("paystack_customer_code", customer);
        }
        break;
      case "subscription.disable":
      case "subscription.not_renew":
        // Pro stays active until plan_expires_at; just stop expecting renewals.
        if (customer) {
          await createAdminClient()
            .from("profiles")
            .update({ paystack_subscription_code: null })
            .eq("paystack_customer_code", customer);
        }
        break;
    }
  } catch (e) {
    // Non-2xx makes Paystack retry later, which is what we want on transient errors.
    console.error("[paystack] webhook handling failed", (e as Error).message);
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
