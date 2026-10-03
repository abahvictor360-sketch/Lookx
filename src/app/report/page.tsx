import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getPublicLookup } from "@/lib/lookup/public";
import { getBasicNumberDetails } from "@/lib/lookup/phone/details";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Report a number or image", robots: { index: false } };

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const params = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  ).toString();
  const { user } = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/report${qs ? `?${qs}` : ""}`)}`);

  const type = params.type === "image" ? "image" : "phone";
  let image: { lookupId: string; thumbnailUrl: string | null } | null = null;
  if (type === "image" && typeof params.lookup === "string") {
    const lookup = await getPublicLookup(params.lookup);
    if (lookup?.type === "image") image = { lookupId: lookup.id, thumbnailUrl: lookup.thumbnailUrl };
  }
  const phone = typeof params.number === "string" ? getBasicNumberDetails(params.number) : null;

  return (
    <div className="hero-glow flex-1 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Report {type === "image" ? "an image" : "a number"}
        </h1>
        <p className="mt-2 text-ink-muted">
          Help others stay safe. Describe what happened factually. Your identity is never shown publicly.
        </p>

        {type === "image" && !image ? (
          <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted shadow-sm">
            To report an image, look it up first, then use <strong>Report this image</strong> on the results page.{" "}
            <Link href="/" className="font-semibold text-brand underline">Look up an image</Link>
          </div>
        ) : (
          <ReportForm
            type={type}
            initialPhone={phone?.national ?? ""}
            phoneLabel={phone?.formatted ?? null}
            image={image}
          />
        )}

        <p className="mt-6 text-xs text-ink-muted">
          False or malicious reports break our{" "}
          <Link href="/legal/terms" className="underline">terms of use</Link> and can lead to a ban. Number owners
          can dispute reports, and moderators review every dispute.
        </p>
      </div>
    </div>
  );
}
