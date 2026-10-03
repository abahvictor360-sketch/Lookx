import Link from "next/link";
import { loadQueue, queueCounts, type QueueItem, type QueueTab } from "@/lib/reports/admin-queue";
import { REPORT_CATEGORIES, REPORT_PLATFORMS } from "@/lib/reports/constants";
import { banReporter, moderateReport, resolveDispute } from "./actions";

const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const btn = "rounded-full px-4 py-2 text-sm font-semibold";

function NoteField() {
  return (
    <input
      name="note"
      maxLength={500}
      placeholder="Note (optional, internal)"
      aria-label="Moderation note"
      className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm focus:border-brand focus:outline-none"
    />
  );
}

function Item({ item, tab }: { item: QueueItem; tab: QueueTab }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        {item.target.kind === "image" ? (
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-mint-50">
            {item.target.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL
              <img src={item.target.thumbnailUrl} alt="Reported image" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center p-2 text-center text-[11px] text-ink-muted">Image file deleted (24h)</span>
            )}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {item.target.kind === "phone" ? item.target.label : `Image · ${item.target.reportCount} public report(s)`}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {label(REPORT_CATEGORIES, item.category)} · via {label(REPORT_PLATFORMS, item.platform)} · submitted {fmt(item.created_at)}
            {tab === "recent" && (
              <> · <strong className={item.status === "approved" ? "text-brand" : "text-risk-high"}>{item.status}</strong> {item.moderated_at && fmt(item.moderated_at)}</>
            )}
          </p>
          <p className="mt-2 whitespace-pre-line text-ink">{item.description}</p>
          {item.evidenceUrl && (
            <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-brand underline">
              View screenshot evidence
            </a>
          )}
          {item.moderation_note && <p className="mt-2 text-xs text-ink-muted">Note: {item.moderation_note}</p>}

          {item.dispute && (
            <div className="mt-3 rounded-xl bg-risk-caution-bg p-3 text-sm">
              <p className="font-semibold text-risk-caution">
                Disputed by {item.dispute.claimantPhone} {item.dispute.verified ? "(verified by SMS)" : "(not verified)"} · {fmt(item.dispute.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-line text-ink">{item.dispute.reason}</p>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-muted">
            Reporter: {item.reporter.email ?? "unknown"} · account {item.reporter.accountDays}d old · {item.reporter.approved} approved /{" "}
            {item.reporter.rejected} rejected{item.reporter.banned && " · BANNED"}
          </p>
        </div>
      </div>

      {tab === "pending" && (
        <form action={moderateReport} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={item.id} />
          <NoteField />
          <button name="decision" value="approve" className={`${btn} bg-brand text-white hover:bg-brand-hover`}>Approve</button>
          <button name="decision" value="reject" className={`${btn} border border-risk-high text-risk-high hover:bg-risk-high-bg`}>Reject</button>
        </form>
      )}
      {tab === "disputed" && (
        <form action={resolveDispute} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="report_id" value={item.id} />
          <NoteField />
          <button name="decision" value="keep" className={`${btn} bg-brand text-white hover:bg-brand-hover`}>Keep report</button>
          <button name="decision" value="remove" className={`${btn} border border-risk-high text-risk-high hover:bg-risk-high-bg`}>Remove report</button>
        </form>
      )}
      {tab !== "recent" && !item.reporter.banned && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-muted">More actions</summary>
          <form action={banReporter} className="mt-2">
            <input type="hidden" name="user_id" value={item.reporter.id} />
            <button className={`${btn} border border-risk-high text-risk-high hover:bg-risk-high-bg`}>
              Ban this reporter and reject their pending reports
            </button>
          </form>
        </details>
      )}
    </li>
  );
}

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const params = await searchParams;
  const tab: QueueTab = params.tab === "disputed" ? "disputed" : params.tab === "recent" ? "recent" : "pending";
  const [items, counts] = await Promise.all([loadQueue(tab), queueCounts()]);

  const tabs: { key: QueueTab; label: string; count?: number }[] = [
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "disputed", label: "Disputed", count: counts.disputed },
    { key: "recent", label: "Recent decisions" },
  ];
  const empty = {
    pending: "No reports waiting for moderation.",
    disputed: "No open disputes.",
    recent: "No moderation decisions yet.",
  }[tab];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Reports</h2>
        <p className="mt-1 text-sm text-ink-muted">
          New accounts&apos; reports wait here before going public. Disputed reports stay public with a label until you decide.
        </p>
      </div>
      <nav aria-label="Queue" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reports?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t.key ? "bg-brand text-white" : "border border-line bg-white text-ink hover:border-brand"}`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 opacity-80">({t.count})</span>}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((i) => <Item key={i.id} item={i} tab={tab} />)}
        </ul>
      )}
    </div>
  );
}
