import Link from "next/link";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Phone lookup" },
      { href: "/", label: "Image lookup" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/report", label: "Report a number" },
      { href: "/dispute", label: "Dispute a report" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/terms", label: "Terms of use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-forest-900 text-white/75">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3 text-sm">
          <Logo tone="light" />
          <p>Look it up before you pay, date, or trust.</p>
          <p className="text-white/60">
            Results are a risk indicator, not a verdict. LookX never identifies people from their
            face. Using LookX to stalk, harass or locate anyone leads to a ban.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold text-brand-bright">{col.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} LookX. Made for Nigeria, built for Africa.
      </p>
    </footer>
  );
}
