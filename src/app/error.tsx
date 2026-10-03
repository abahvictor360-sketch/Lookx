"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="hero-glow flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-ink-muted">Please try again. If it keeps happening, come back in a few minutes.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-hover">Try again</button>
        <Link href="/" className="rounded-full border border-line bg-white px-6 py-3 font-semibold hover:border-brand">Home</Link>
      </div>
    </div>
  );
}
