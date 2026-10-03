"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/plans";

type Props = { product: Product; label: string; signedIn: boolean; highlight?: boolean };

/**
 * Starts a Paystack inline checkout. The server picks the price and returns an
 * access code; the popup collects payment; we then ask the server to verify.
 * If the popup can't load, we fall back to Paystack's hosted checkout page.
 */
export function BuyButton({ product, label, signedIn, highlight }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setError(null);
    if (!signedIn) {
      router.push("/login?next=/pricing");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as {
      access_code?: string;
      reference?: string;
      authorization_url?: string;
      error?: string;
    };
    if (!res?.ok || !data.access_code || !data.reference) {
      setBusy(false);
      setError(data?.error ?? "Couldn't start checkout. Please try again.");
      return;
    }

    try {
      const { default: PaystackPop } = await import("@paystack/inline-js");
      const popup = new PaystackPop();
      popup.resumeTransaction(data.access_code, {
        onSuccess: () => router.push(`/payment/callback?reference=${encodeURIComponent(data.reference!)}`),
        onCancel: () => setBusy(false),
        onError: () => {
          if (data.authorization_url) window.location.href = data.authorization_url;
          else {
            setBusy(false);
            setError("Couldn't open the payment window. Please try again.");
          }
        },
      });
    } catch {
      if (data.authorization_url) window.location.href = data.authorization_url;
      else setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className={`w-full rounded-full px-5 py-3 font-semibold disabled:opacity-70 ${
          highlight ? "bg-brand text-white hover:bg-brand-hover" : "border border-brand bg-white text-brand hover:bg-brand-soft"
        }`}
      >
        {busy ? "Opening checkout…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-risk-high">{error}</p>}
    </div>
  );
}
