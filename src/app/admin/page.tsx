import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/plans";
import { RiskBadge } from "@/components/result/risk-badge";
import { LookupsChart } from "@/components/admin/lookups-chart";

type Stats = {
  lookups_by_day: { day: string; phone: number; image: number }[];
  risk_30d: { low: number; caution: number; high: number };
  users_total: number;
  users_7d: number;
  pro_active: number;
  lookups_30d: number;
  guest_lookups_30d: number;
  revenue_30d_kobo: number;
  reports_pending: number;
  reports_disputed: number;
  reports_approved_30d: number;
  data_requests_open: number;
  banned_users: number;
};

function Tile({ label, value, hint, href, attention }: { label: string; value: string | number; hint?: string; href?: string; attention?: boolean }) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${attention ? "text-risk-caution" : "text-ink"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-white p-5 shadow-sm";
  return href ? <Link href={href} className={`${cls} hover:border-brand`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export default async function AdminHome() {
  // admin_stats() refuses non-admins at the database level too.
  const { data } = await (await createClient()).rpc("admin_stats");
  const s = data as unknown as Stats;

  return (
    <div className="space-y-6">
      <section aria-label="Needs attention" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Pending reports" value={s.reports_pending} href="/admin/reports?tab=pending" attention={s.reports_pending > 0} />
        <Tile label="Open disputes" value={s.reports_disputed} href="/admin/reports?tab=disputed" attention={s.reports_disputed > 0} />
        <Tile label="Open data requests" value={s.data_requests_open} hint="Respond within 30 days (NDPA/GDPR)" href="/admin/requests" attention={s.data_requests_open > 0} />
        <Tile label="Flagged & banned users" value={s.banned_users} hint="banned · see flagged list" href="/admin/users" />
      </section>

      <LookupsChart days={s.lookups_by_day} />

      <section aria-label="Last 30 days" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Lookups (30 days)" value={s.lookups_30d} hint={`${s.guest_lookups_30d} by guests`} />
        <Tile label="Revenue (30 days)" value={formatNaira(s.revenue_30d_kobo)} />
        <Tile label="Users" value={s.users_total} hint={`${s.users_7d} new this week · ${s.pro_active} on Pro`} />
        <Tile label="Approved reports (30 days)" value={s.reports_approved_30d} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-bold">Risk results (30 days)</h2>
        <ul className="mt-3 flex flex-wrap gap-6">
          {(["low", "caution", "high"] as const).map((level) => (
            <li key={level} className="flex items-center gap-3">
              <RiskBadge level={level} size="sm" />
              <span className="text-xl font-extrabold">{s.risk_30d[level]}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-ink-muted">
        Product analytics (page views, devices) are in Vercel Analytics. Figures here come straight from the database.
      </p>
    </div>
  );
}
