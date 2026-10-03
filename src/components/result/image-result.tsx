"use client";

import type { PublicImageLookup } from "@/lib/lookup/public";
import type { Likelihood } from "@/lib/lookup/image/types";
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

const LIKELIHOOD: Record<Likelihood, { label: string; cls: string }> = {
  low: { label: "Low", cls: "bg-mint-100 text-brand" },
  medium: { label: "Medium", cls: "bg-risk-caution-bg text-risk-caution" },
  high: { label: "High", cls: "bg-risk-high-bg text-risk-high" },
  unknown: { label: "Unknown", cls: "bg-page text-ink-muted ring-1 ring-line" },
};

function LikelihoodRow({ label, level, note }: { label: string; level: Likelihood; note: string }) {
  const l = LIKELIHOOD[level];
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-sm font-medium text-ink">{label}</dt>
        <dd className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${l.cls}`}>{l.label}</dd>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{note}</p>
    </div>
  );
}

export function ImageResultView({ initial }: { initial: PublicImageLookup }) {
  const { lookup, done } = usePolledLookup(initial);
  const { image, question, metadata, matches, reports, authenticity, risk, ai } = lookup.results;
  const thumb = lookup.thumbnailUrl;

  return (
    <div className="flex-1">
      <div className="hero-glow border-b border-line px-4 py-8 sm:py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:flex-row sm:items-start">
          <div className="h-36 w-36 shrink-0 overflow-hidden rounded-2xl border border-line bg-white shadow-sm sm:h-40 sm:w-40">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
              <img src={thumb} alt="The image you looked up" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-xs text-ink-muted">
                Image deleted after 24 hours for privacy
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand">Image lookup</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {question ? question.label : "Where does this image appear?"}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {image.width}×{image.height} · {image.mime.replace("image/", "").toUpperCase()}
              {image.sourceDomain ? ` · from ${image.sourceDomain}` : ""}
            </p>
            <RiskPanel risk={risk} done={done} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {question && (
            <Card title="Your question" id="answer">
              <p className="text-sm text-ink-muted">{question.label}</p>
              {ai ? (
                <p className="mt-2 leading-relaxed text-ink">{ai.answer ?? "We couldn't answer this from the evidence found."}</p>
              ) : done ? <Unavailable /> : <div className="mt-2"><Skeleton lines={2} /></div>}
            </Card>
          )}

          <Card title="Summary" id="summary">
            {ai ? (
              <>
                <p className="leading-relaxed text-ink">{ai.summary}</p>
                {ai.status !== "ok" && <p className="mt-2 text-xs text-ink-muted">Automatic summary from the sources below.</p>}
              </>
            ) : done ? <Unavailable /> : <Skeleton lines={4} />}
            <RiskReasons risk={risk} />
          </Card>

          <Card title="Where this image appears" id="matches">
            {matches ? (
              matches.status === "not_configured" ? (
                <p className="text-sm text-ink-muted">Reverse image search isn&apos;t available right now.</p>
              ) : matches.status === "error" ? (
                <Unavailable />
              ) : matches.total === 0 ? (
                <p className="text-sm text-ink-muted">
                  We found no other pages using this exact image. Many social profiles aren&apos;t indexed, so this
                  isn&apos;t proof the photo is original.
                </p>
              ) : (
                <>
                  {matches.possibleStolen.flag && (
                    <p className="mb-4 rounded-xl bg-risk-high-bg px-4 py-3 text-sm font-medium text-risk-high">
                      Possible stolen photo: {matches.possibleStolen.reason}.
                    </p>
                  )}
                  <p className="text-sm text-ink">
                    Found on <strong>{matches.total}</strong> page{matches.total === 1 ? "" : "s"} across{" "}
                    <strong>{matches.groups.length}</strong> site{matches.groups.length === 1 ? "" : "s"}.
                  </p>
                  <ul className="mt-4 space-y-4">
                    {matches.groups.map((g) => (
                      <li key={g.domain} className="rounded-xl border border-line p-4">
                        <p className="flex items-center gap-2 text-sm font-bold text-ink">
                          {g.domain}
                          {g.isProfileSite && (
                            <span className="rounded bg-mint-100 px-1.5 py-0.5 text-xs font-semibold text-brand">Social / profile site</span>
                          )}
                          <span className="ml-auto text-xs font-normal text-ink-muted">{g.matches.length}</span>
                        </p>
                        <ul className="mt-2 space-y-2">
                          {g.matches.map((m) => (
                            <li key={m.url} className="text-sm">
                              <a href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand hover:underline">
                                {m.title}
                              </a>
                              {m.date && <span className="ml-2 text-xs text-ink-muted">first seen {m.date}</span>}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : done ? <Unavailable /> : <Skeleton lines={5} />}
          </Card>

          <ReportsCard reports={reports} done={done} noun="image" />
        </div>

        <aside className="space-y-5">
          <Card title="Authenticity" id="authenticity">
            {authenticity ? (
              authenticity.status === "ok" ? (
                <>
                  <dl className="divide-y divide-line">
                    <LikelihoodRow label="AI-generated" level={authenticity.aiGenerated.level} note={authenticity.aiGenerated.note} />
                    <LikelihoodRow label="Edited or manipulated" level={authenticity.edited.level} note={authenticity.edited.note} />
                    <LikelihoodRow label="Stock / catalog photo" level={authenticity.stockOrCatalog.level} note={authenticity.stockOrCatalog.note} />
                  </dl>
                  {authenticity.visibleText.length > 0 && (
                    <div className="mt-3 rounded-xl bg-mint-50 p-3 text-sm">
                      <p className="font-medium text-ink">Visible watermarks or usernames</p>
                      <ul className="mt-1 list-disc pl-5 text-ink-muted">
                        {authenticity.visibleText.map((t) => <li key={t}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-ink-muted">Automated estimate from visual signs. Not proof.</p>
                </>
              ) : (
                <p className="text-sm text-ink-muted">{authenticity.aiGenerated.note}</p>
              )
            ) : done ? <Unavailable /> : <Skeleton lines={4} />}
          </Card>

          <Card title="Metadata" id="metadata">
            {metadata.found ? (
              <dl className="space-y-3 text-sm">
                {[
                  ["Camera", metadata.camera ?? "Not recorded"],
                  ["Date taken", metadata.takenAt ? fmtDate(metadata.takenAt) : "Not recorded"],
                  ["Software", metadata.software ?? "Not recorded"],
                  ["Location data", metadata.hasGps ? "Present (not shown)" : "None"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-ink-muted">No metadata found (often stripped by social platforms).</p>
            )}
            {metadata.hasGps && (
              <p className="mt-3 text-xs text-ink-muted">
                This file contains location data. LookX never shows it, so it can&apos;t be used to locate anyone.
              </p>
            )}
          </Card>

          <ResultActions
            lookup={lookup}
            reportHref={`/report?type=image&lookup=${lookup.id}`}
            reportLabel="Report this image"
            shareTitle="LookX image check"
          />

          <p className="text-xs text-ink-muted">
            Checked {fmtDate(lookup.created_at)}. LookX shows where an image appears, not who is in it. Uploaded
            images are deleted after 24 hours.
          </p>
        </aside>
      </div>
    </div>
  );
}
