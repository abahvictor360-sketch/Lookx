"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicLookup } from "@/lib/lookup/public";
import type { ReportsSection, RiskSection } from "@/lib/lookup/phone/types";
import type { ReportCategory, ReportPlatform } from "@/lib/supabase/database.types";
import { RiskBadge } from "./risk-badge";

const POLL_MS = 1000;
const POLL_LIMIT_MS = 35_000;

export const CATEGORY: Record<ReportCategory, string> = {
  scam: "Scam",
  fake_vendor: "Fake vendor",
  spam: "Spam",
  harassment: "Harassment",
  impersonation: "Impersonation",
};
export const PLATFORM: Record<ReportPlatform, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  jiji: "Jiji",
  telegram: "Telegram",
  phone_call: "Phone call",
  sms: "SMS",
  other: "Other",
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

/** Polls GET /api/lookup/[id] while the pipeline is still filling in sections. */
export function usePolledLookup<T extends PublicLookup>(initial: T) {
  const [lookup, setLookup] = useState(initial);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (lookup.status !== "processing") return;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > POLL_LIMIT_MS) {
        setTimedOut(true);
        clearInterval(timer);
        return;
      }
      const res = await fetch(`/api/lookup/${lookup.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) {
        const next = (await res.json()) as T;
        setLookup(next);
        if (next.status !== "processing") clearInterval(timer);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [lookup.id, lookup.status]);

  return { lookup, done: lookup.status !== "processing" || timedOut };
}

export function Card({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 id={id} className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function Unavailable() {
  return <p className="text-sm text-ink-muted">This source didn&apos;t respond. Try again later.</p>;
}

export function RiskPanel({ risk, done }: { risk?: RiskSection; done: boolean }) {
  return (
    <div className="mt-5 rounded-2xl border border-line bg-white/90 p-4 shadow-sm" aria-live="polite">
      {risk ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="self-start sm:self-auto"><RiskBadge level={risk.level} /></span>
          <p className="font-medium text-ink">{risk.headline}</p>
        </div>
      ) : done ? (
        <p className="text-sm text-ink-muted">We couldn&apos;t finish checking every source.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="skeleton h-8 w-28 rounded-full" />
          <div className="skeleton h-4 flex-1" />
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">Risk indicator, not a verdict.</p>
    </div>
  );
}

export function RiskReasons({ risk }: { risk?: RiskSection }) {
  if (!risk || risk.reasons.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl bg-mint-50 p-4">
      <p className="text-sm font-semibold text-ink">Why this indicator</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        {risk.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}

export function ReportsCard({ reports, done, noun }: { reports?: ReportsSection; done: boolean; noun: string }) {
  return (
    <Card title="Community reports" id="reports">
      {reports ? (
        reports.total === 0 ? (
          <p className="text-sm text-ink-muted">
            No approved reports for this {noun} yet. No reports doesn&apos;t mean it&apos;s safe.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink">
              <strong>{reports.total}</strong> approved report{reports.total === 1 ? "" : "s"}
              {reports.recentCount > 0 && <>, {reports.recentCount} in the last 14 days</>}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Report categories">
              {Object.entries(reports.byCategory).map(([cat, n]) => (
                <li key={cat} className="rounded-full bg-risk-high-bg px-3 py-1 text-xs font-semibold text-risk-high">
                  {CATEGORY[cat as ReportCategory]} · {n}
                </li>
              ))}
            </ul>
            <ul className="mt-4 space-y-3">
              {reports.recent.map((r, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <p className="text-xs text-ink-muted">
                    {CATEGORY[r.category]} · via {PLATFORM[r.platform]} · {fmtDate(r.created_at)}
                  </p>
                  <p className="mt-1 text-sm text-ink">&ldquo;{r.excerpt}&rdquo;</p>
                </li>
              ))}
            </ul>
          </>
        )
      ) : done ? <Unavailable /> : <Skeleton />}
    </Card>
  );
}

/** Report / Save / Share buttons. */
export function ResultActions({
  lookup,
  reportHref,
  reportLabel,
  shareTitle,
}: {
  lookup: PublicLookup;
  reportHref: string;
  reportLabel: string;
  shareTitle: string;
}) {
  const [saved, setSaved] = useState(lookup.viewer.saved);
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg("Link copied");
    } catch {
      setMsg(null);
    }
  }

  async function toggleSave() {
    const res = await fetch(`/api/lookup/${lookup.id}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saved: !saved }),
    });
    if (res.ok) setSaved(!saved);
  }

  return (
    <div className="flex flex-col gap-3">
      <Link href={reportHref} className="rounded-full bg-brand px-5 py-3 text-center font-semibold text-white hover:bg-brand-hover">
        {reportLabel}
      </Link>
      {lookup.viewer.isOwner ? (
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          className="rounded-full border border-brand bg-white px-5 py-3 font-semibold text-brand hover:bg-brand-soft"
        >
          {saved ? "Saved to history ✓" : "Save to history"}
        </button>
      ) : !lookup.viewer.isSignedIn ? (
        <Link href="/login" className="rounded-full border border-brand bg-white px-5 py-3 text-center font-semibold text-brand hover:bg-brand-soft">
          Sign in to save lookups
        </Link>
      ) : null}
      <button type="button" onClick={share} className="rounded-full border border-line bg-white px-5 py-3 font-semibold text-ink hover:border-brand">
        Share result
      </button>
      <p className="min-h-4 text-center text-xs text-ink-muted" aria-live="polite">
        {msg ?? "Shared links never show who ran the lookup."}
      </p>
    </div>
  );
}
