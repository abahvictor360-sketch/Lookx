"use client";

import { useId, useState } from "react";

const TYPES = [
  { value: "access", label: "Send me a copy of my data" },
  { value: "correction", label: "Correct my data" },
  { value: "deletion", label: "Delete my data" },
  { value: "review_reports", label: "Review reports about my number" },
  { value: "objection", label: "Object to how my data is used" },
  { value: "other", label: "Something else" },
];

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink-muted/80 focus:border-brand focus:outline-none";

export function DataRequestForm() {
  const ids = { email: useId(), phone: useId(), type: useId(), details: useId() };
  const [form, setForm] = useState({ email: "", phone: "", request_type: "access", details: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const res = await fetch("/api/data-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, phone: form.phone || undefined }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    if (!res?.ok) {
      setState("idle");
      return setError(data?.error ?? "Something went wrong. Please try again.");
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="text-lg font-bold">Request received</p>
        <p className="mt-2 text-sm text-ink-muted">
          We&apos;ll reply to {form.email} within 30 days. We may ask you to confirm your identity before acting on it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <div>
        <label htmlFor={ids.email} className="text-sm font-semibold">Your email</label>
        <input id={ids.email} type="email" autoComplete="email" required value={form.email} onChange={set("email")} className={field} />
      </div>
      <div>
        <label htmlFor={ids.phone} className="text-sm font-semibold">Phone number <span className="font-normal text-ink-muted">(if your request is about a number)</span></label>
        <input id={ids.phone} inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="0801 234 5678" className={field} />
      </div>
      <div>
        <label htmlFor={ids.type} className="text-sm font-semibold">What would you like us to do?</label>
        <select id={ids.type} value={form.request_type} onChange={set("request_type")} className={field}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={ids.details} className="text-sm font-semibold">Details</label>
        <textarea id={ids.details} rows={5} maxLength={2000} value={form.details} onChange={set("details")} className={`${field} resize-y`} />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-risk-high">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
        {state === "sending" ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
