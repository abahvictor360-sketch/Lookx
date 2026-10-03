import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getMembership } from "@/lib/teams/server";
import { csvCell, readBulkJob } from "@/lib/teams/bulk-read";

/** GET /api/team/bulk/[id]/csv: download a bulk job's results. */
export async function GET(_request: Request, ctx: RouteContext<"/api/team/bulk/[id]/csv">) {
  const { user } = await getCurrentUser();
  const membership = user ? await getMembership(user.id) : null;
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await readBulkJob((await ctx.params).id, membership.team.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const header = ["number", "network", "line_type", "status", "risk_level", "risk_score", "headline", "community_reports", "disputed_reports", "web_mentions", "summary", "result_url"];
  const lines = job.results.map((r) =>
    [
      r.number.e164,
      r.number.network,
      r.number.line_type,
      r.status,
      r.risk?.level,
      r.risk?.score,
      r.risk?.headline,
      r.reports?.total,
      r.reports?.disputed,
      r.web_mentions?.results.length,
      r.summary,
      r.result_url,
    ]
      .map(csvCell)
      .join(","),
  );
  const body = [header.join(","), ...lines].join("\r\n");
  return new NextResponse(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lookx-bulk-${job.id.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
