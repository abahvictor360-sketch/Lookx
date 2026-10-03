import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const PLAN_LABEL = { free: "Free", starter: "Starter", pro: "Pro", business: "Business" } as const;

export default async function DashboardPage() {
  const { user, profile } = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
      <p className="mt-1 text-sm text-ink-muted">{user.email}</p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-navy-700 bg-navy-800 p-5">
          <dt className="text-sm text-ink-muted">Plan</dt>
          <dd className="mt-1 text-xl font-semibold">{PLAN_LABEL[profile?.plan ?? "free"]}</dd>
        </div>
        <div className="rounded-2xl border border-navy-700 bg-navy-800 p-5">
          <dt className="text-sm text-ink-muted">Paid credits</dt>
          <dd className="mt-1 text-xl font-semibold">{profile?.credits ?? 0}</dd>
        </div>
      </dl>

      <form action="/auth/signout" method="post" className="mt-8">
        <button
          type="submit"
          className="rounded-xl border border-navy-600 px-4 py-2 text-sm font-semibold hover:border-accent"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
