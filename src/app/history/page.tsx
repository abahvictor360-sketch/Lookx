import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { FREE_HISTORY_DAYS, effectivePlan } from "@/lib/plans";
import { RiskBadge } from "@/components/result/risk-badge";
import type { LookupType, RiskLevel } from "@/lib/supabase/database.types";
import { RerunButton } from "./rerun-button";

export const metadata: Metadata = { title: "History", robots: { index: false } };

const PAGE_SIZE = 25;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "phone", label: "Phone" },
  { key: "image", label: "Image" },
  { key: "saved", label: "Saved" },
] as const;

type Row = {
  id: string;
  type: LookupType;
  normalized_query: string | null;
  risk_level: RiskLevel | null;
  status: string;
  saved: boolean;
  question: string | null;
  created_at: string;
};

function formatPhone(e164: string | null) {
  if (!e164) return "Phone number";
  return e164.startsWith("+234") ? `+234 ${e164.slice(4, 7)} ${e164.slice(7, 10)} ${e164.slice(10)}` : e164;
}

async function loadHistory(userId: string, filter: string, page: number, fullHistory: boolean) {
  const supabase = await createClient();
  let query = supabase
    .from("lookups")
    .select("id, type, normalized_query, risk_level, status, saved, question, created_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (filter === "phone" || filter === "image") query = query.eq("type", filter);
  if (filter === "saved") query = query.eq("saved", true);
  // Free/Starter: last 30 days (saved results are always kept).
  if (!fullHistory && filter !== "saved") {
    query = query.gte("created_at", new Date(Date.now() - FREE_HISTORY_DAYS * 86_400_000).toISOString());
  }
  const { data, count } = await query;
  return {
    rows: (data ?? []) as Row[],
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    dayAgo: Date.now() - 86_400_000,
  };
}

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/history");

  const params = await searchParams;
  const filter = FILTERS.find((f) => f.key === params.filter)?.key ?? "all";
  const page = Math.max(1, Number(params.page) || 1);
  const plan = effectivePlan(profile);
  const fullHistory = plan === "pro" || plan === "business";

  const { rows, pages, dayAgo } = await loadHistory(user.id, filter, page, fullHistory);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {fullHistory
              ? "Your full lookup history."
              : <>Lookups from the last {FREE_HISTORY_DAYS} days, plus anything you saved. <Link href="/pricing" className="font-semibold text-brand underline">Pro</Link> keeps your full history.</>}
          </p>
        </div>
        <nav aria-label="Filter" className="flex gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/history?filter=${f.key}`}
              aria-current={filter === f.key ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f.key ? "bg-brand text-white" : "border border-line bg-white hover:border-brand"}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-ink-muted">
          {filter === "saved" ? "Nothing saved yet. Use “Save to history” on a result." : "No lookups yet."}{" "}
          <Link href="/" className="font-semibold text-brand underline">Start a lookup</Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-brand ring-1 ring-mint-200">
                {r.type === "phone" ? "☎" : "▣"}
              </span>
              <Link href={`/result/${r.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block font-semibold text-ink">
                  {r.type === "phone" ? formatPhone(r.normalized_query) : r.question ?? "Image lookup"}
                  {r.saved && <span className="ml-2 text-xs font-semibold text-brand">★ Saved</span>}
                </span>
                <span className="text-xs text-ink-muted">
                  {r.type === "phone" ? "Phone" : "Image"} ·{" "}
                  {new Date(r.created_at).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </Link>
              <span className="flex items-center justify-between gap-3 sm:justify-end">
                {r.risk_level ? <RiskBadge level={r.risk_level} size="sm" /> : <span className="text-xs text-ink-muted">{r.status === "failed" ? "Failed" : "Processing"}</span>}
                <RerunButton
                  type={r.type}
                  query={r.normalized_query}
                  lookupId={r.id}
                  disabledReason={r.type === "image" && Date.parse(r.created_at) < dayAgo ? "Image deleted (24h)" : undefined}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex justify-center gap-2 text-sm">
          {page > 1 && <Link href={`/history?filter=${filter}&page=${page - 1}`} className="rounded-full border border-line bg-white px-4 py-2 hover:border-brand">Newer</Link>}
          <span className="px-3 py-2 text-ink-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`/history?filter=${filter}&page=${page + 1}`} className="rounded-full border border-line bg-white px-4 py-2 hover:border-brand">Older</Link>}
        </nav>
      )}
    </div>
  );
}
