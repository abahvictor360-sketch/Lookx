import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getMembership } from "@/lib/teams/server";
import { readBulkJob } from "@/lib/teams/bulk-read";

/** GET /api/team/bulk/[id]: progress for the bulk job page (team members only). */
export async function GET(_request: Request, ctx: RouteContext<"/api/team/bulk/[id]">) {
  const { user } = await getCurrentUser();
  const membership = user ? await getMembership(user.id) : null;
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await readBulkJob((await ctx.params).id, membership.team.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}
