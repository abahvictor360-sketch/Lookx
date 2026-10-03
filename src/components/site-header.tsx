import Link from "next/link";
import { Logo } from "./logo";
import { isSupabaseConfigured } from "@/lib/public-env";
import { getCurrentUser } from "@/lib/supabase/server";

export async function SiteHeader() {
  const { user, profile } = isSupabaseConfigured
    ? await getCurrentUser()
    : { user: null, profile: null };

  return (
    <header className="border-b border-navy-700/70 bg-navy-900/90 backdrop-blur supports-[backdrop-filter]:bg-navy-900/70">
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Logo />
        <ul className="flex items-center gap-1 text-sm sm:gap-2">
          <li>
            <Link href="/pricing" className="rounded-md px-2 py-2 text-ink-muted hover:text-ink sm:px-3">
              Pricing
            </Link>
          </li>
          {user ? (
            <>
              <li className="hidden sm:block">
                <Link href="/history" className="rounded-md px-3 py-2 text-ink-muted hover:text-ink">
                  History
                </Link>
              </li>
              {profile?.role === "admin" && (
                <li className="hidden sm:block">
                  <Link href="/admin" className="rounded-md px-3 py-2 text-ink-muted hover:text-ink">
                    Admin
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/dashboard"
                  className="rounded-md border border-navy-600 px-3 py-2 text-ink hover:border-accent"
                >
                  Account
                </Link>
              </li>
            </>
          ) : (
            <li>
              <Link
                href="/login"
                className="rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink hover:bg-accent-hover"
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
