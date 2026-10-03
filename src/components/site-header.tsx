import Link from "next/link";
import { Logo } from "./logo";
import { isSupabaseConfigured } from "@/lib/public-env";
import { getCurrentUser } from "@/lib/supabase/server";
import { getMembership } from "@/lib/teams/server";

const linkClass = "rounded-md px-2 py-2 text-ink-muted hover:text-brand sm:px-3";

export async function SiteHeader() {
  const { user, profile } = isSupabaseConfigured
    ? await getCurrentUser()
    : { user: null, profile: null };
  const membership = user ? await getMembership(user.id) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <ul className="flex items-center gap-1 text-sm font-medium">
          <li className="hidden sm:block">
            <Link href="/" className={linkClass}>Home</Link>
          </li>
          <li>
            <Link href="/pricing" className={linkClass}>Pricing</Link>
          </li>
          {user ? (
            <>
              <li className="hidden sm:block">
                <Link href="/history" className={linkClass}>History</Link>
              </li>
              {membership && (
                <li>
                  <Link href="/team" className={linkClass}>Team</Link>
                </li>
              )}
              {profile?.role === "admin" && (
                <li className="hidden sm:block">
                  <Link href="/admin" className={linkClass}>Admin</Link>
                </li>
              )}
              <li className="ml-1">
                <Link
                  href="/dashboard"
                  className="rounded-full border border-brand px-4 py-2 font-semibold text-brand hover:bg-brand-soft"
                >
                  Account
                </Link>
              </li>
            </>
          ) : (
            <li className="ml-1">
              <Link
                href="/login"
                className="rounded-full bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-hover"
              >
                Sign in
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
