"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** Pull phone-number-like tokens out of pasted text or a CSV file. */
function extractNumbers(text: string) {
  const matches = text.match(/\+?\d[\d\s().-]{6,18}\d/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/[\s().-]/g, "")))];
}

export function BulkForm({ max }: { max: number }) {
  const router = useRouter();
  const ids = { text: useId(), label: useId(), file: useId() };
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numbers = useMemo(() => extractNumbers(text), [text]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 512 * 1024) return setError("CSV files must be under 512KB.");
    setText((await file.text()).slice(0, 100_000));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (numbers.length === 0) return setError("Paste at least one phone number.");
    if (numbers.length > max) return setError(`That's ${numbers.length} numbers. The limit is ${max} per job.`);
    setBusy(true);
    const res = await fetch("/api/team/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones: numbers, label: label || undefined }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { id?: string; error?: string; rejected?: unknown[] };
    if (!res?.ok || !data.id) {
      setBusy(false);
      return setError(data?.error ?? "Couldn't start the bulk lookup.");
    }
    router.push(`/team/bulk/${data.id}${data.rejected?.length ? `?skipped=${data.rejected.length}` : ""}`);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <div>
        <label htmlFor={ids.text} className="text-sm font-semibold">Phone numbers</label>
        <textarea
          id={ids.text}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"One per line, or separated by commas\n08031234567\n+234 805 111 2222"}
          className="mt-1 w-full resize-y rounded-xl border border-line px-3 py-2.5 font-mono text-sm focus:border-brand focus:outline-none"
        />
        <p className="mt-1 text-xs text-ink-muted" aria-live="polite">
          {numbers.length} number{numbers.length === 1 ? "" : "s"} found{numbers.length > max ? `, limit is ${max}` : ""}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.file} className="text-sm font-semibold">Or upload a CSV</label>
          <input
            id={ids.file}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="mt-1 block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand"
          />
        </div>
        <div>
          <label htmlFor={ids.label} className="text-sm font-semibold">Label <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id={ids.label} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. New riders, October" className="mt-1 w-full rounded-full border border-line px-4 py-2 text-sm focus:border-brand focus:outline-none" />
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-risk-high">{error}</p>}
      <button disabled={busy} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
        {busy ? "Starting…" : `Look up ${numbers.length || ""} number${numbers.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
