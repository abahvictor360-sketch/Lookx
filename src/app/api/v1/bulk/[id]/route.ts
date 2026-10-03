import { NextResponse } from "next/server";
import { apiError, authenticateApi } from "@/lib/api/auth";
import { serializePhoneLookup } from "@/lib/api/serialize";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/v1/bulk/{id}: progress and results of a bulk job made by the same team. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/bulk/[id]">) {
  const auth = await authenticateApi(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(404, "not_found", "Bulk job not found.");

  const db = createAdminClient();
  const { data: job } = await db.from("bulk_jobs").select("id, team_id, label, total, created_at").eq("id", id).maybeSingle();
  if (!job || job.team_id !== auth.teamId) return apiError(404, "not_found", "Bulk job not found.");

  const { data: rows } = await db
    .from("lookups")
    .select("id, status, risk_level, created_at, raw_results")
    .eq("bulk_job_id", id)
    .order("created_at");
  const results = (rows ?? []).map(serializePhoneLookup);
  const done = results.filter((r) => r.status !== "processing").length;
  return NextResponse.json({
    id: job.id,
    label: job.label,
    created_at: job.created_at,
    status: done === results.length ? "complete" : "processing",
    total: results.length,
    completed: done,
    results,
  });
}
