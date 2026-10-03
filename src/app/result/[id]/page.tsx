import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicLookup } from "@/lib/lookup/public";
import { PhoneResultView } from "@/components/result/phone-result";

export const metadata: Metadata = {
  title: "Lookup result",
  // Shared by link only; keep results out of search engines.
  robots: { index: false, follow: false },
};

export default async function ResultPage({ params }: PageProps<"/result/[id]">) {
  const { id } = await params;
  const lookup = await getPublicLookup(id);
  if (!lookup) notFound();

  if (lookup.type !== "phone") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-ink-muted">
        Image results arrive in the next release.
      </div>
    );
  }
  return <PhoneResultView initial={lookup} />;
}
