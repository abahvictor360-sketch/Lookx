import type { Metadata } from "next";
import Link from "next/link";
import { requireTeam, MAX_BULK } from "@/lib/teams/server";
import { BulkForm } from "./bulk-form";

export const metadata: Metadata = { title: "Bulk lookup", robots: { index: false } };

export default async function BulkPage() {
  const { team } = await requireTeam();
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/team" className="text-sm font-semibold text-brand underline">← {team.name}</Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Bulk lookup</h1>
      <p className="mt-2 text-ink-muted">
        Check up to {MAX_BULK} phone numbers at once, for example new customers, agents or riders. Each number uses
        one lookup from your team&apos;s allowance. Results arrive in about a minute and can be downloaded as CSV.
      </p>
      <BulkForm max={MAX_BULK} />
    </div>
  );
}
