import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeam } from "@/lib/teams/server";
import { readBulkJob } from "@/lib/teams/bulk-read";
import { BulkResults } from "./bulk-results";

export const metadata: Metadata = { title: "Bulk results", robots: { index: false } };

export default async function BulkJobPage({ params, searchParams }: PageProps<"/team/bulk/[id]">) {
  const { team } = await requireTeam();
  const { id } = await params;
  const job = await readBulkJob(id, team.id);
  if (!job) notFound();
  const skipped = Number((await searchParams).skipped) || 0;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Link href="/team" className="text-sm font-semibold text-brand underline">← {team.name}</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{job.label ?? "Bulk lookup"}</h1>
      {skipped > 0 && (
        <p className="mt-2 rounded-xl bg-risk-caution-bg px-4 py-2 text-sm text-risk-caution">
          {skipped} entr{skipped === 1 ? "y was" : "ies were"} skipped (invalid numbers, or the team ran out of lookups).
        </p>
      )}
      <BulkResults initial={job} />
    </div>
  );
}
