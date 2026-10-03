import Link from "next/link";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.5 4.5 6.8v8.4c0 7 4.9 12.3 11.5 14.3 6.6-2 11.5-7.3 11.5-14.3V6.8L16 2.5Z" fill="currentColor" />
      <circle cx="14.6" cy="14.4" r="5" fill="none" stroke="#fff" strokeWidth="2.4" />
      <path d="m18.3 18.1 3.6 3.6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      aria-label="LookX home"
      className={`flex items-center gap-2 text-xl font-extrabold tracking-tight ${tone === "dark" ? "text-ink" : "text-white"}`}
    >
      <LogoMark className={`h-8 w-8 ${tone === "dark" ? "text-brand" : "text-brand-bright"}`} />
      <span>
        Look<span className={tone === "dark" ? "text-brand" : "text-brand-bright"}>X</span>
      </span>
    </Link>
  );
}
