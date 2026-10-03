import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-ink" aria-label="LookX home">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <circle cx="14" cy="14" r="9" fill="none" stroke="var(--color-accent)" strokeWidth="3" />
        <path d="M21 21l7 7" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
        <path d="M10.5 10.5l7 7M17.5 10.5l-7 7" stroke="var(--color-ink)" strokeWidth="2.25" strokeLinecap="round" />
      </svg>
      <span className="text-lg">
        Look<span className="text-accent">X</span>
      </span>
    </Link>
  );
}
