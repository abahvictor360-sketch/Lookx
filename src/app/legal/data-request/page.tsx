import type { Metadata } from "next";
import Link from "next/link";
import { DataRequestForm } from "./form";

export const metadata: Metadata = {
  title: "Data request",
  description: "Ask LookX for a copy of your data, to correct or delete it, or to review reports about your number.",
};

export default function DataRequestPage() {
  return (
    <div className="hero-glow flex-1 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Data request</h1>
        <p className="mt-2 text-ink-muted">
          Under the Nigeria Data Protection Act 2023 and the GDPR you can ask what data we hold about you, have it
          corrected or deleted, or object to how it&apos;s used. We reply within 30 days.
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Want reports about your number reviewed? The fastest route is to{" "}
          <Link href="/dispute" className="font-semibold text-brand underline">dispute them</Link> with SMS verification.
        </p>
        <DataRequestForm />
      </div>
    </div>
  );
}
