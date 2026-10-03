"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BulkJobView } from "@/lib/teams/bulk-read";
import { RiskBadge } from "@/components/result/risk-badge";

export function BulkResults({ initial }: { initial: BulkJobView }) {
  const [job, setJob] = useState(initial);
  const done = job.completed >= job.total;

  useEffect(() => {
    if (done) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/team/bulk/${job.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setJob(await res.json());
    }, 2000);
    return () => clearInterval(t);
  }, [done, job.id]);

  const pct = Math.round((job.completed / Math.max(1, job.total)) * 100);
  const high = job.results.filter((r) => r.risk?.level === "high").length;
  const caution = job.results.filter((r) => r.risk?.level === "caution").length;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-56 flex-1">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {done ? `All ${job.total} checked.` : `Checking… ${job.completed} of ${job.total}`}{" "}
            {done && <><strong className="text-risk-high">{high} high risk</strong>, <strong className="text-risk-caution">{caution} caution</strong>.</>}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-mint-100" role="progressbar" aria-label="Progress" aria-valuenow={job.completed} aria-valuemin={0} aria-valuemax={job.total}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <a href={`/api/team/bulk/${job.id}/csv`} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">
          Download CSV
        </a>
      </div>

      <div className="relative mt-6 overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-mint-50 text-left text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Network</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Why</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {job.results.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{r.number.formatted}</td>
                <td className="px-4 py-3 text-ink-muted">{r.number.network ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.risk ? <RiskBadge level={r.risk.level} size="sm" /> : r.status === "failed" ? <span className="text-xs text-risk-high">Failed</span> : <span className="skeleton inline-block h-5 w-20 rounded-full" aria-label="Checking" />}
                </td>
                <td className="px-4 py-3 text-ink-muted">{r.risk?.headline ?? ""}</td>
                <td className="px-4 py-3 text-right"><Link href={`/result/${r.id}`} className="text-xs font-semibold text-brand underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Risk indicator, not a verdict. Use it alongside your own checks.</p>
    </>
  );
}
