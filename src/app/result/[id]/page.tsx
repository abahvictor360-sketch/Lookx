import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicLookup } from "@/lib/lookup/public";
import { PhoneResultView } from "@/components/result/phone-result";
import { ImageResultView } from "@/components/result/image-result";

export const metadata: Metadata = {
  title: "Lookup result",
  // Shared by link only; keep results out of search engines.
  robots: { index: false, follow: false },
};

export default async function ResultPage({ params }: PageProps<"/result/[id]">) {
  const { id } = await params;
  const lookup = await getPublicLookup(id);
  if (!lookup) notFound();
  return lookup.type === "phone" ? <PhoneResultView initial={lookup} /> : <ImageResultView initial={lookup} />;
}
