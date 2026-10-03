"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { REPORT_CATEGORIES, REPORT_PLATFORMS } from "@/lib/reports/constants";

type Report = {
  id: string;
  category: string;
  platform: string;
  excerpt: string;
  created_at: string;
  status: string;
  disputable: boolean;
};

const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink-muted/80 focus:border-brand focus:outline-none";
const primary = "rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-70";

async function post<T>(url: string, body: unknown): Promise<T & { error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { ...data, error: data.error ?? "Something went wrong. Please try again." };
  } catch {
    return { error: "Network error. Check your connection and try again." } as T & { error: string };
  }
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Your number", "Verify by SMS", "Done"];
  return (
    <ol className="mt-6 flex gap-2 text-xs font-semibold" aria-label="Progress">
      {items.map((t, i) => (
        <li
          key={t}
          aria-current={step === i + 1 ? "step" : undefined}
          className={`flex-1 rounded-full px-3 py-1.5 text-center ${step >= i + 1 ? "bg-brand text-white" : "bg-white text-ink-muted ring-1 ring-line"}`}
        >
          {i + 1}. {t}
        </li>
      ))}
    </ol>
  );
}

export function DisputeFlow() {
  const ids = { phone: useId(), reason: useId(), code: useId() };
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState("");
  const [formatted, setFormatted] = useState("");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  const [disputed, setDisputed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function findReports(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await post<{ phone: { formatted: string }; reports: Report[] }>("/api/dispute/reports", { phone });
    setBusy(false);
    if (r.error) return setError(r.error);
    setFormatted(r.phone.formatted);
    setReports(r.reports);
    setSelected(r.reports.filter((x) => x.disputable).map((x) => x.id));
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) return setError("Choose at least one report to dispute.");
    if (reason.trim().length < 10) return setError("Please explain why in at least 10 characters.");
    setBusy(true);
    const r = await post<{ verification_id: string }>("/api/dispute", { phone, report_ids: selected, reason });
    setBusy(false);
    if (r.error) return setError(r.error);
    setVerificationId(r.verification_id);
    setStep(2);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await post<{ disputed: number }>("/api/dispute/verify", { verification_id: verificationId, code });
    setBusy(false);
    if (r.error) return setError(r.error);
    setDisputed(r.disputed);
    setStep(3);
  }

  const card = "mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6";

  return (
    <>
      <Steps step={step} />

      {step === 1 && (
        <div className={card}>
          <form onSubmit={findReports} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor={ids.phone} className="text-sm font-semibold">Your phone number</label>
              <input
                id={ids.phone}
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setReports(null); }}
                placeholder="0801 234 5678"
                className={field}
              />
            </div>
            <button type="submit" disabled={busy || !phone.trim()} className={primary}>
              {busy && !reports ? "Checking…" : "Find reports"}
            </button>
          </form>

          {reports && reports.length === 0 && (
            <p className="mt-5 rounded-xl bg-mint-50 p-4 text-sm text-ink-muted">
              There are no public reports for {formatted}. Reports waiting for moderation aren&apos;t public, so
              there&apos;s nothing to dispute yet.
            </p>
          )}

          {reports && reports.length > 0 && (
            <form onSubmit={sendCode} noValidate className="mt-6 space-y-5">
              <fieldset>
                <legend className="text-sm font-semibold">Public reports for {formatted}</legend>
                <ul className="mt-2 space-y-2">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <label className={`flex gap-3 rounded-xl border p-3 text-sm ${r.disputable ? "cursor-pointer border-line hover:border-brand" : "border-line opacity-70"}`}>
                        <input
                          type="checkbox"
                          disabled={!r.disputable}
                          checked={selected.includes(r.id)}
                          onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
                        />
                        <span>
                          <span className="block text-xs text-ink-muted">
                            {label(REPORT_CATEGORIES, r.category)} · via {label(REPORT_PLATFORMS, r.platform)} · {fmt(r.created_at)}
                            {!r.disputable && " · already under review"}
                          </span>
                          <span className="mt-1 block text-ink">&ldquo;{r.excerpt}&rdquo;</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              {reports.some((r) => r.disputable) ? (
                <>
                  <div>
                    <label htmlFor={ids.reason} className="text-sm font-semibold">Why are these reports wrong?</label>
                    <textarea
                      id={ids.reason}
                      rows={4}
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. I got this number in March 2026. The reports are about the previous owner."
                      className={`${field} resize-y`}
                    />
                  </div>
                  <p className="text-xs text-ink-muted">
                    We&apos;ll text a 6-digit code to {formatted}. Only the person with this phone can complete the dispute.
                  </p>
                  <button type="submit" disabled={busy} className={primary}>{busy ? "Sending code…" : "Send code"}</button>
                </>
              ) : (
                <p className="text-sm text-ink-muted">All reports for this number are already being reviewed.</p>
              )}
            </form>
          )}
        </div>
      )}

      {step === 2 && (
        <form onSubmit={verify} noValidate className={card}>
          <label htmlFor={ids.code} className="text-sm font-semibold">Enter the code we sent to {formatted}</label>
          <input
            id={ids.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className={`${field} max-w-48 text-center text-2xl tracking-[0.4em]`}
          />
          <p className="mt-2 text-xs text-ink-muted">The code expires in 10 minutes.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={busy || code.length < 4} className={primary}>{busy ? "Checking…" : "Verify and submit"}</button>
            <button type="button" onClick={() => { setStep(1); setCode(""); setError(null); }} className="rounded-full border border-line bg-white px-5 py-3 text-sm font-semibold hover:border-brand">
              Start again
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div role="status" className={card}>
          <p className="text-lg font-bold text-ink">Dispute received</p>
          <p className="mt-2 text-sm text-ink-muted">
            {disputed > 0
              ? `${disputed} report${disputed === 1 ? " is" : "s are"} now marked as disputed and will be reviewed by a moderator. While under review, they stay visible with a "disputed" label.`
              : "Those reports were already being reviewed, so nothing changed."}
          </p>
          <Link href="/" className={`mt-4 inline-block ${primary}`}>Back to LookX</Link>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm font-medium text-risk-high">{error}</p>}
    </>
  );
}
