import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_CATEGORIES } from "@/lib/reports/constants";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting for review", cls: "bg-risk-caution-bg text-risk-caution" },
  approved: { label: "Public", cls: "bg-mint-100 text-brand" },
  disputed: { label: "Public, disputed", cls: "bg-risk-caution-bg text-risk-caution" },
  rejected: { label: "Not published", cls: "bg-page text-ink-muted ring-1 ring-line" },
};

/** The user's own reports (RLS: read own), with phone numbers for display. */
async function myReports(userId: string) {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, target_id, category, status, created_at")
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!reports?.length) return [];
  const phoneIds = reports.filter((r) => r.target_type === "phone").map((r) => r.target_id);
  const { data: phones } = phoneIds.length
    ? await createAdminClient().from("phone_numbers").select("id, e164_number").in("id", phoneIds)
    : { data: [] };
  return reports.map((r) => ({
    ...r,
    target: r.target_type === "phone" ? (phones?.find((p) => p.id === r.target_id)?.e164_number ?? "Phone number") : "Image",
  }));
}

const PLAN_LABEL = { free: "Free", starter: "Starter", pro: "Pro", business: "Business" } as const;

export default async function DashboardPage() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  const reports = await myReports(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
      <p className="mt-1 text-sm text-ink-muted">{user.email}</p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <dt className="text-sm text-ink-muted">Plan</dt>
          <dd className="mt-1 text-xl font-semibold">{PLAN_LABEL[profile?.plan ?? "free"]}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <dt className="text-sm text-ink-muted">Paid credits</dt>
          <dd className="mt-1 text-xl font-semibold">{profile?.credits ?? 0}</dd>
        </div>
      </dl>

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
                    {" "}· {REPORT_CATEGORIES.find((c) => c.value === r.category)?.label} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action="/auth/signout" method="post" className="mt-8">
        <button
          type="submit"
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
