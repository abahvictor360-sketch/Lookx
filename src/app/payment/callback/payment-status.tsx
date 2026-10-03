"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Polls the verify endpoint briefly; the webhook may land first, which is fine. */
export function PaymentStatus({ reference }: { reference: string }) {
  const [status, setStatus] = useState<"checking" | "success" | "pending" | "failed">(reference ? "checking" : "failed");

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`).catch(() => null);
        const data = (await res?.json().catch(() => ({}))) as { status?: string };
        if (data?.status === "success") return setStatus("success");
        if (data?.status === "not_paid" || data?.status === "mismatch" || res?.status === 404) return setStatus("failed");
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!cancelled) setStatus("pending");
    })();
    return () => { cancelled = true; };
  }, [reference]);

  const copy = {
    checking: ["Confirming your payment…", "This takes a few seconds."],
    success: ["Payment successful", "Your account has been updated. Thank you for supporting LookX."],
    pending: ["Payment is processing", "We'll update your account as soon as Paystack confirms it. You can safely leave this page."],
    failed: ["Payment not completed", "No money was taken, or the payment couldn't be confirmed. Please try again."],
  }[status];

  return (
    <div role="status" aria-live="polite" className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
      {status === "checking" ? (
        <div className="skeleton mx-auto h-12 w-12 rounded-full" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl ${status === "success" ? "bg-mint-100 text-brand" : status === "failed" ? "bg-risk-high-bg text-risk-high" : "bg-risk-caution-bg text-risk-caution"}`}>
          {status === "success" ? "✓" : status === "failed" ? "!" : "…"}
        </span>
      )}
      <h1 className="mt-4 text-2xl font-extrabold">{copy[0]}</h1>
      <p className="mt-2 text-sm text-ink-muted">{copy[1]}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/dashboard" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">Go to dashboard</Link>
        {status === "failed" && (
          <Link href="/pricing" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-brand">Try again</Link>
        )}
      </div>
    </div>
  );
}
