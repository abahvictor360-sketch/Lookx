import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { serializePhoneLookup } from "@/lib/api/serialize";

/** A team's bulk job with its results (null if it doesn't belong to the team). */
export async function readBulkJob(jobId: string, teamId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const db = createAdminClient();
  const { data: job } = await db.from("bulk_jobs").select("id, team_id, label, total, created_at").eq("id", jobId).maybeSingle();
  if (!job || job.team_id !== teamId) return null;
  const { data: rows } = await db
    .from("lookups")
    .select("id, status, risk_level, created_at, raw_results")
    .eq("bulk_job_id", jobId)
    .order("created_at");
  const results = (rows ?? []).map(serializePhoneLookup);
  const completed = results.filter((r) => r.status !== "processing").length;
  return { id: job.id, label: job.label, created_at: job.created_at, total: results.length, completed, results };
}

export type BulkJobView = NonNullable<Awaited<ReturnType<typeof readBulkJob>>>;

/** CSV-safe cell: quote, escape quotes, and neutralise spreadsheet formulas. */
export function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
