"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicLookup } from "@/lib/lookup/public";
import type { LineType } from "@/lib/lookup/phone/types";
import type { ReportCategory, ReportPlatform } from "@/lib/supabase/database.types";
import { RiskBadge } from "./risk-badge";

const POLL_MS = 1000;
const POLL_LIMIT_MS = 30_000;

const LINE_TYPE: Record<LineType, string> = {
  mobile: "Mobile",
  landline: "Landline",
  voip: "VoIP (internet number)",
  toll_free: "Toll-free",
  other: "Other",
  unknown: "Unknown",
};
const CATEGORY: Record<ReportCategory, string> = {
  scam: "Scam",
  fake_vendor: "Fake vendor",
  spam: "Spam",
  harassment: "Harassment",
  impersonation: "Impersonation",
};
const PLATFORM: Record<ReportPlatform, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  jiji: "Jiji",
  telegram: "Telegram",
  phone_call: "Phone call",
  sms: "SMS",
  other: "Other",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

function Card({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 id={id} className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function PhoneResultView({ initial }: { initial: PublicLookup }) {
  const [lookup, setLookup] = useState(initial);
  const [timedOut, setTimedOut] = useState(false);
  const [saved, setSaved] = useState(initial.viewer.saved);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Poll while the pipeline is still filling in sections.
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
        const next = (await res.json()) as PublicLookup;
        setLookup(next);
        if (next.status !== "processing") clearInterval(timer);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [lookup.id, lookup.status]);

  const { number, web, reports, risk, ai } = lookup.results;
  const done = lookup.status !== "processing" || timedOut;
  const unavailable = <p className="text-sm text-ink-muted">This source didn&apos;t respond. Try again later.</p>;

  async function share() {
    const url = window.location.href;
    const title = `LookX result for ${number.formatted}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied");
    } catch {
      setShareMsg(null);
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
    <div className="flex-1">
      {/* Header band: number + risk badge */}
      <div className="hero-glow border-b border-line px-4 py-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold text-brand">Phone lookup</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{number.formatted}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[number.countryName, number.carrier, LINE_TYPE[number.lineType]].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-5 rounded-2xl border border-line bg-white/90 p-4 shadow-sm" aria-live="polite">
            {risk ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <RiskBadge level={risk.level} />
                <p className="font-medium text-ink">{risk.headline}</p>
              </div>
            ) : done ? (
              <p className="text-sm text-ink-muted">We couldn&apos;t finish checking every source for this number.</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="skeleton h-8 w-28 rounded-full" />
                <div className="skeleton h-4 flex-1" />
              </div>
            )}
            <p className="mt-2 text-xs text-ink-muted">Risk indicator, not a verdict.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="Summary" id="summary">
            {ai ? (
              <>
                <p className="leading-relaxed text-ink">{ai.summary}</p>
                {ai.status !== "ok" && (
                  <p className="mt-2 text-xs text-ink-muted">Automatic summary from the sources below.</p>
                )}
              </>
            ) : done ? unavailable : <Skeleton lines={4} />}
            {risk && risk.reasons.length > 0 && (
              <div className="mt-4 rounded-xl bg-mint-50 p-4">
                <p className="text-sm font-semibold text-ink">Why this indicator</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
                  {risk.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Community reports" id="reports">
            {reports ? (
              reports.total === 0 ? (
                <p className="text-sm text-ink-muted">
                  No approved reports for this number yet. No reports doesn&apos;t mean a number is safe.
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
            ) : done ? unavailable : <Skeleton />}
          </Card>

          <Card title="Web mentions" id="web">
            {web ? (
              web.status === "not_configured" ? (
                <p className="text-sm text-ink-muted">Web search isn&apos;t available right now.</p>
              ) : web.status === "error" ? (
                unavailable
              ) : web.results.length === 0 ? (
                <p className="text-sm text-ink-muted">We found no public web pages mentioning this number.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {web.results.map((m) => (
                    <li key={m.url} className="py-3 first:pt-0 last:pb-0">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-semibold text-brand hover:underline"
                      >
                        {m.title}
                      </a>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {m.domain}{m.date ? ` · ${m.date}` : ""}
                        {m.flagged && (
                          <span className="ml-2 rounded bg-risk-caution-bg px-1.5 py-0.5 font-semibold text-risk-caution">
                            Scam keywords
                          </span>
                        )}
                      </p>
                      {m.snippet && <p className="mt-1 text-sm text-ink-muted">{m.snippet}</p>}
                    </li>
                  ))}
                </ul>
              )
            ) : done ? unavailable : <Skeleton lines={5} />}
          </Card>
        </div>

        <aside className="space-y-5 lg:order-none">
          <Card title="Number details" id="details">
            <dl className="space-y-3 text-sm">
              {[
                ["Number", number.formatted],
                ["Local format", number.national],
                ["Country", number.countryName ?? "Unknown"],
                ["Network", number.carrier ?? "Unknown"],
                ["Line type", LINE_TYPE[number.lineType]],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {number.carrierSource === "prefix" && (
              <p className="mt-3 text-xs text-ink-muted">
                Network is the number&apos;s original allocation. It may have been ported.
              </p>
            )}
          </Card>

          <div className="flex flex-col gap-3">
            <Link
              href={`/report?type=phone&number=${encodeURIComponent(number.e164)}`}
              className="rounded-full bg-brand px-5 py-3 text-center font-semibold text-white hover:bg-brand-hover"
            >
              Report this number
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
              <Link
                href="/login"
                className="rounded-full border border-brand bg-white px-5 py-3 text-center font-semibold text-brand hover:bg-brand-soft"
              >
                Sign in to save lookups
              </Link>
            ) : null}
            <button
              type="button"
              onClick={share}
              className="rounded-full border border-line bg-white px-5 py-3 font-semibold text-ink hover:border-brand"
            >
              Share result
            </button>
            <p className="min-h-4 text-center text-xs text-ink-muted" aria-live="polite">
              {shareMsg ?? "Shared links never show who ran the lookup."}
            </p>
          </div>

          <p className="text-xs text-ink-muted">
            Checked {fmtDate(lookup.created_at)}. LookX shows what public sources and community
            reports say about a number. It is a risk indicator, not proof.
          </p>
        </aside>
      </div>
    </div>
  );
}
