"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Re-runs a lookup: phone numbers by number, images by reusing the stored file (24h). */
export function RerunButton({ type, query, lookupId, disabledReason }: {
  type: "phone" | "image";
  query: string | null;
  lookupId: string;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rerun() {
    setBusy(true);
    setError(null);
    const res = await fetch(type === "phone" ? "/api/lookup/phone" : "/api/lookup/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(type === "phone" ? { phone: query } : { rerun_of: lookupId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { id?: string; error?: string };
    if (res?.ok && data.id) return router.push(`/result/${data.id}`);
    setBusy(false);
    setError(data?.error ?? "Couldn't re-run. Please try again.");
  }

  if (disabledReason) {
    return <span className="text-xs text-ink-muted" title={disabledReason}>{disabledReason}</span>;
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={rerun}
        disabled={busy}
        className="rounded-full border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"
      >
        {busy ? "Running…" : "Re-run"}
      </button>
      {error && <span role="alert" className="max-w-48 text-right text-xs text-risk-high">{error}</span>}
    </span>
  );
}
