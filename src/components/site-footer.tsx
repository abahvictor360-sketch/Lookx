import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-navy-700/70 bg-navy-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md space-y-2">
          <p className="font-semibold text-ink">LookX</p>
          <p>
            Results are a risk indicator, not a verdict. LookX shows what public sources and
            community reports say; it never identifies people from their face.
          </p>
          <p>
            Using LookX to stalk, harass or locate anyone is prohibited and leads to a ban.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          <li><Link className="hover:text-ink" href="/pricing">Pricing</Link></li>
          <li><Link className="hover:text-ink" href="/dispute">Dispute a report</Link></li>
          <li><Link className="hover:text-ink" href="/legal/privacy">Privacy</Link></li>
          <li><Link className="hover:text-ink" href="/legal/terms">Terms</Link></li>
        </ul>
      </div>
      <p className="pb-6 text-center text-xs text-ink-muted">© {new Date().getFullYear()} LookX</p>
    </footer>
  );
}
