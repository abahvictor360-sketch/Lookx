import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { isSupabaseConfigured } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const authError = typeof params.error === "string";

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(next);
  }

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-14 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-navy-700 bg-navy-800 p-6 shadow-xl shadow-black/30">
        <h1 className="text-2xl font-bold tracking-tight">Sign in to LookX</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Get free monthly lookups, image checks, saved history, and the ability to report numbers.
        </p>
        {authError && (
          <p role="alert" className="mt-4 rounded-lg bg-risk-high/10 px-3 py-2 text-sm text-risk-high">
            That sign-in link was invalid or expired. Please try again.
          </p>
        )}
        {isSupabaseConfigured ? (
          <LoginForm next={next} />
        ) : (
          <p className="mt-6 text-sm text-risk-caution">
            Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.
          </p>
        )}
        <p className="mt-6 text-xs text-ink-muted">
          By continuing you agree to the{" "}
          <a href="/legal/terms" className="underline hover:text-ink">Terms of use</a> and{" "}
          <a href="/legal/privacy" className="underline hover:text-ink">Privacy policy</a>.
        </p>
      </div>
    </div>
  );
}
