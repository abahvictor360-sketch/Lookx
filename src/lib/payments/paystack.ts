import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Minimal Paystack API client (server only). The secret key never reaches the
 * browser: the client only ever receives an access code to open the popup.
 */

// Overridable only so tests can point at a local mock of the Paystack API.
const BASE = process.env.PAYSTACK_API_BASE || "https://api.paystack.co";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serverEnv.paystackSecretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !body.status || !body.data) throw new Error(`Paystack ${path}: ${body.message ?? res.status}`);
  return body.data;
}

export function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  plan?: string;
  metadata: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      ...(input.plan ? { plan: input.plan } : {}),
    }),
  });
}

export type VerifiedTransaction = {
  status: string; // "success" when paid
  reference: string;
  amount: number; // kobo
  currency: string;
  customer?: { customer_code?: string; email?: string };
  plan?: string | { plan_code?: string } | null;
};

/** Ask Paystack directly for the transaction's real status. Never trust client or webhook payloads alone. */
export function verifyTransaction(reference: string) {
  return call<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function planCodeOf(tx: Pick<VerifiedTransaction, "plan">) {
  return typeof tx.plan === "string" ? tx.plan : (tx.plan?.plan_code ?? null);
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function isValidWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha512", serverEnv.paystackSecretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
