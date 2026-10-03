import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured, publicEnv } from "@/lib/public-env";
import { getCurrentUser } from "@/lib/supabase/server";
import { FREE_MONTHLY, GUEST_PHONE_LOOKUPS_PER_DAY, PRO_MONTHLY_LOOKUPS, PRODUCTS, effectivePlan, formatNaira } from "@/lib/plans";
import { BuyButton } from "./buy-button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free lookups every month, ₦2,000 for 30 lookups that never expire, or Pro for ₦5,000 a month.",
};

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

export default async function PricingPage() {
  const { user, profile } = isSupabaseConfigured ? await getCurrentUser() : { user: null, profile: null };
  const plan = effectivePlan(profile);
  const signedIn = Boolean(user);

  return (
    <div className="flex-1">
      <section className="hero-glow px-4 pb-10 pt-14 text-center">
        <p className="mx-auto w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">Pricing</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Check first. <span className="text-brand-bright">Pay less to stay safe.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">
          Start free. Buy credits when you need more. Payments are processed securely by Paystack.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Free</h2>
          <p className="mt-2 text-3xl font-extrabold">₦0</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-muted">
            <Check>{FREE_MONTHLY.phone} phone lookups a month</Check>
            <Check>{FREE_MONTHLY.image} image lookups a month</Check>
            <Check>{GUEST_PHONE_LOOKUPS_PER_DAY} phone lookups a day without an account</Check>
            <Check>Report numbers and images</Check>
            <Check>30 days of history</Check>
          </ul>
          <Link
            href={signedIn ? "/" : "/login?next=/"}
            className="mt-6 rounded-full border border-line px-5 py-3 text-center font-semibold hover:border-brand"
          >
            {signedIn ? "Start a lookup" : "Create free account"}
          </Link>
        </div>

        <div className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Starter</h2>
          <p className="mt-2 text-3xl font-extrabold">{formatNaira(PRODUCTS.starter.amountKobo)}</p>
          <p className="text-sm text-ink-muted">one-off</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-muted">
            <Check>{PRODUCTS.starter.credits} lookups (phone or image)</Check>
            <Check>Credits never expire</Check>
            <Check>Used after your free monthly lookups</Check>
            <Check>Buy again any time</Check>
          </ul>
          <div className="mt-6"><BuyButton product="starter" label="Buy 30 lookups" signedIn={signedIn} /></div>
        </div>

        <div className="relative flex flex-col rounded-2xl border-2 border-brand bg-white p-6 shadow-lg shadow-brand/10">
          <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs font-bold text-white">Most popular</span>
          <h2 className="text-lg font-bold">Pro</h2>
          <p className="mt-2 text-3xl font-extrabold">{formatNaira(PRODUCTS.pro.amountKobo)}</p>
          <p className="text-sm text-ink-muted">per month</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-muted">
            <Check>{PRO_MONTHLY_LOOKUPS} lookups every month</Check>
            <Check>Priority results: deeper AI analysis and higher limits</Check>
            <Check>Full lookup history</Check>
            <Check>Unused credits stay on your account</Check>
          </ul>
          <div className="mt-6">
            {plan === "pro" ? (
              <p className="rounded-full bg-brand-soft px-5 py-3 text-center font-semibold text-brand">You&apos;re on Pro</p>
            ) : (
              <BuyButton product="pro" label="Go Pro" signedIn={signedIn} highlight />
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-line bg-forest-900 p-6 text-white/80 shadow-sm">
          <h2 className="text-lg font-bold text-white">Business</h2>
          <p className="mt-2 text-3xl font-extrabold text-white">Custom</p>
          <p className="text-sm">for teams</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm">
            <Check>API access</Check>
            <Check>Bulk lookups with CSV export</Check>
            <Check>Team seats with shared credits</Check>
            <Check>Verify customers, agents and riders</Check>
          </ul>
          {publicEnv.contactEmail && (
            <a
              href={`mailto:${publicEnv.contactEmail}?subject=LookX%20Business`}
              className="mt-6 rounded-full bg-brand-bright px-5 py-3 text-center font-semibold text-forest-900 hover:bg-white"
            >
              Talk to us
            </a>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 text-sm text-ink-muted">
        <h2 className="text-lg font-bold text-ink">Questions</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-semibold text-ink">What counts as a lookup?</dt>
            <dd>One phone number or one image checked. Viewing or sharing a result again is free.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Which is used first?</dt>
            <dd>Your free (or Pro) monthly lookups are used first, then paid credits.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Can I cancel Pro?</dt>
            <dd>Yes. Pro stays active until the end of the month you paid for, and any Starter credits remain.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
