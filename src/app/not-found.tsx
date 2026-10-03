import Link from "next/link";

export default function NotFound() {
  return (
    <div className="hero-glow flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-ink-muted">The link may be wrong, or the result may have been removed.</p>
      <Link href="/" className="mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-hover">Start a lookup</Link>
    </div>
  );
}
