"use client";

import type { PublicPhoneLookup } from "@/lib/lookup/public";
import type { LineType } from "@/lib/lookup/phone/types";
import {
  Card,
  ReportsCard,
  ResultActions,
  RiskPanel,
  RiskReasons,
  Skeleton,
  Unavailable,
  fmtDate,
  usePolledLookup,
} from "./shared";

const LINE_TYPE: Record<LineType, string> = {
  mobile: "Mobile",
  landline: "Landline",
  voip: "VoIP (internet number)",
  toll_free: "Toll-free",
  other: "Other",
  unknown: "Unknown",
};

export function PhoneResultView({ initial }: { initial: PublicPhoneLookup }) {
  const { lookup, done } = usePolledLookup(initial);
  const { number, web, reports, risk, ai } = lookup.results;

  return (
    <div className="flex-1">
      <div className="hero-glow border-b border-line px-4 py-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold text-brand">Phone lookup</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{number.formatted}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {[number.countryName, number.carrier, LINE_TYPE[number.lineType]].filter(Boolean).join(" · ")}
          </p>
          <RiskPanel risk={risk} done={done} />
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="Summary" id="summary">
            {ai ? (
              <>
                <p className="leading-relaxed text-ink">{ai.summary}</p>
                {ai.status !== "ok" && <p className="mt-2 text-xs text-ink-muted">Automatic summary from the sources below.</p>}
              </>
            ) : done ? <Unavailable /> : <Skeleton lines={4} />}
            <RiskReasons risk={risk} />
          </Card>

          <ReportsCard reports={reports} done={done} noun="number" />

          <Card title="Web mentions" id="web">
            {web ? (
              web.status === "not_configured" ? (
                <p className="text-sm text-ink-muted">Web search isn&apos;t available right now.</p>
              ) : web.status === "error" ? (
                <Unavailable />
              ) : web.results.length === 0 ? (
                <p className="text-sm text-ink-muted">We found no public web pages mentioning this number.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {web.results.map((m) => (
                    <li key={m.url} className="py-3 first:pt-0 last:pb-0">
                      <a href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand hover:underline">
                        {m.title}
                      </a>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {m.domain}{m.date ? ` · ${m.date}` : ""}
                        {m.flagged && (
                          <span className="ml-2 rounded bg-risk-caution-bg px-1.5 py-0.5 font-semibold text-risk-caution">Scam keywords</span>
                        )}
                      </p>
                      {m.snippet && <p className="mt-1 text-sm text-ink-muted">{m.snippet}</p>}
                    </li>
                  ))}
                </ul>
              )
            ) : done ? <Unavailable /> : <Skeleton lines={5} />}
          </Card>
        </div>

        <aside className="space-y-5">
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
              <p className="mt-3 text-xs text-ink-muted">Network is the number&apos;s original allocation. It may have been ported.</p>
            )}
          </Card>

          <ResultActions
            lookup={lookup}
            reportHref={`/report?type=phone&number=${encodeURIComponent(number.e164)}`}
            reportLabel="Report this number"
            shareTitle={`LookX result for ${number.formatted}`}
          />

          <p className="text-xs text-ink-muted">
            Checked {fmtDate(lookup.created_at)}. LookX shows what public sources and community reports say
            about a number. It is a risk indicator, not proof.
          </p>
        </aside>
      </div>
    </div>
  );
}
