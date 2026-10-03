import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_CATEGORIES } from "@/lib/reports/constants";
import { FREE_MONTHLY, PLAN_LABEL, PRO_MONTHLY_LOOKUPS, PRODUCTS, effectivePlan, formatNaira } from "@/lib/plans";
import { RiskBadge } from "@/components/result/risk-badge";
import { getMembership } from "@/lib/teams/server";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting for review", cls: "bg-risk-caution-bg text-risk-caution" },
  approved: { label: "Public", cls: "bg-mint-100 text-brand" },
  disputed: { label: "Public, disputed", cls: "bg-risk-caution-bg text-risk-caution" },
  rejected: { label: "Not published", cls: "bg-page text-ink-muted ring-1 ring-line" },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

async function loadDashboard(userId: string) {
  const supabase = await createClient();
  const [usage, saved, payments, reports, adjustments] = await Promise.all([
    supabase.rpc("my_usage_this_month"),
    supabase
      .from("lookups")
      .select("id, type, normalized_query, question, risk_level, created_at")
      .eq("user_id", userId)
      .eq("saved", true)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("transactions")
      .select("id, product, amount, status, created_at, paid_at")
      .eq("user_id", userId)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("reports")
      .select("id, target_type, target_id, category, status, created_at")
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("credit_adjustments")
      .select("id, applied, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const phoneIds = (reports.data ?? []).filter((r) => r.target_type === "phone").map((r) => r.target_id);
  const { data: phones } = phoneIds.length
    ? await createAdminClient().from("phone_numbers").select("id, e164_number").in("id", phoneIds)
    : { data: [] };

  return {
    usage: usage.data?.[0] ?? { free_phone: 0, free_image: 0, plan_used: 0, credit_used: 0 },
    saved: saved.data ?? [],
    payments: payments.data ?? [],
    adjustments: adjustments.data ?? [],
    reports: (reports.data ?? []).map((r) => ({
      ...r,
      target: r.target_type === "phone" ? (phones?.find((p) => p.id === r.target_id)?.e164_number ?? "Phone number") : "Image",
    })),
  };
}

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-semibold text-ink">{Math.max(0, total - used)} of {total} left</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-mint-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const params = await searchParams;
  const { usage, saved, payments, reports, adjustments } = await loadDashboard(user.id);
  const plan = effectivePlan(profile);
  const isPro = plan === "pro";
  const membership = await getMembership(user.id);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Your account</h1>
          <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/history" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold hover:border-brand">History</Link>
          {profile?.role === "admin" && (
            <Link href="/admin" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold hover:border-brand">Admin</Link>
          )}
          <Link href="/" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">New lookup</Link>
        </div>
      </div>

      {membership && (
        <Link href="/team" className="mt-4 block rounded-2xl border border-brand bg-brand-soft px-5 py-4 text-sm hover:bg-mint-100">
          <strong className="text-ink">You&apos;re in {membership.team.name}.</strong>{" "}
          <span className="text-ink-muted">Your lookups are billed to the team. Open the team page for bulk lookups and API keys →</span>
        </Link>
      )}

      {params.paid && (
        <p role="status" className="mt-4 rounded-xl bg-mint-100 px-4 py-3 text-sm font-medium text-brand">Payment received. Thank you!</p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-sm text-ink-muted">Plan</h2>
          <p className="mt-1 text-2xl font-extrabold">{PLAN_LABEL[plan]}</p>
          {isPro && profile?.plan_expires_at && (
            <p className="mt-1 text-xs text-ink-muted">
              {profile.paystack_subscription_code ? "Renews" : "Active until"} {fmtDate(profile.plan_expires_at)}
            </p>
          )}
          {!isPro && plan !== "business" && (
            <Link href="/pricing" className="mt-3 inline-block text-sm font-semibold text-brand underline">Upgrade to Pro</Link>
          )}
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-sm text-ink-muted">Paid credits</h2>
          <p className="mt-1 text-2xl font-extrabold">{profile?.credits ?? 0}</p>
          <p className="mt-1 text-xs text-ink-muted">Never expire. Used after your monthly lookups.</p>
          <Link href="/pricing" className="mt-3 inline-block text-sm font-semibold text-brand underline">
            Buy {PRODUCTS.starter.credits} for {formatNaira(PRODUCTS.starter.amountKobo)}
          </Link>
        </section>
        <section className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-sm text-ink-muted">This month</h2>
          {isPro ? (
            <Meter label="Pro lookups" used={usage.plan_used} total={PRO_MONTHLY_LOOKUPS} />
          ) : (
            <>
              <Meter label="Free phone lookups" used={usage.free_phone} total={FREE_MONTHLY.phone} />
              <Meter label="Free image lookups" used={usage.free_image} total={FREE_MONTHLY.image} />
            </>
          )}
          {usage.credit_used > 0 && <p className="text-xs text-ink-muted">{usage.credit_used} credit{usage.credit_used === 1 ? "" : "s"} used this month</p>}
        </section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="saved">
          <div className="flex items-center justify-between">
            <h2 id="saved" className="text-lg font-bold">Saved results</h2>
            <Link href="/history?filter=saved" className="text-sm font-semibold text-brand underline">See all</Link>
          </div>
          {saved.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Use “Save to history” on a result to keep it here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
              {saved.map((l) => (
                <li key={l.id}>
                  <Link href={`/result/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-mint-50">
                    <span className="min-w-0 truncate font-medium">{l.type === "phone" ? l.normalized_query : (l.question ?? "Image lookup")}</span>
                    {l.risk_level && <RiskBadge level={l.risk_level} size="sm" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="payments">
          <h2 id="payments" className="text-lg font-bold">Payments and credits</h2>
          {adjustments.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
              {adjustments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium">{a.applied >= 0 ? "Credits added by LookX" : "Credits removed by LookX"}</span>
                    <span className="text-ink-muted"> · {a.reason} · {fmtDate(a.created_at)}</span>
                  </span>
                  <span className={`font-semibold ${a.applied >= 0 ? "text-brand" : "text-risk-high"}`}>{a.applied >= 0 ? `+${a.applied}` : a.applied}</span>
                </li>
              ))}
            </ul>
          )}
          {payments.length === 0 ? (
            adjustments.length === 0 && <p className="mt-2 text-sm text-ink-muted">No payments yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
              {payments.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium">{PRODUCTS[t.product].name}</span>
                    <span className="text-ink-muted"> · {fmtDate(t.paid_at ?? t.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {formatNaira(t.amount)}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.status === "success" ? "bg-mint-100 text-brand" : "bg-risk-high-bg text-risk-high"}`}>
                      {t.status === "success" ? "Paid" : "Failed"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="my-reports" className="mt-8">
        <h2 id="my-reports" className="text-lg font-bold">Your reports</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">You haven&apos;t reported anything yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium text-ink">{r.target}</span>
                  <span className="text-ink-muted">
                    {" "}· {REPORT_CATEGORIES.find((c) => c.value === r.category)?.label} · {fmtDate(r.created_at)}
                  </span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action="/auth/signout" method="post" className="mt-10">
        <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">Sign out</button>
      </form>
    </div>
  );
}
