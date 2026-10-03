import { NextResponse, after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/server";
import { getMembership, MAX_BULK } from "@/lib/teams/server";
import { createBulkJob, runBulk } from "@/lib/teams/bulk";
import { hashValue } from "@/lib/hash";
import { getClientIp } from "@/lib/request-meta";
import { hitRateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;

const Body = z.object({ phones: z.array(z.string().max(32)).min(1).max(MAX_BULK * 4), label: z.string().trim().max(80).optional() });

/** POST /api/team/bulk: bulk lookup for signed-in team members. */
export async function POST(request: Request) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const membership = await getMembership(user.id);
  if (!membership) return NextResponse.json({ error: "Bulk lookups are for Business accounts." }, { status: 403 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: `Add between 1 and ${MAX_BULK} numbers.` }, { status: 400 });
  if (!(await hitRateLimit(`team:${membership.team.id}`, "bulk_hour", 3600, 20))) {
    return NextResponse.json({ error: "Too many bulk jobs this hour." }, { status: 429 });
  }

  const job = await createBulkJob({
    teamId: membership.team.id,
    phones: parsed.data.phones,
    createdBy: user.id,
    label: parsed.data.label,
    ipHash: hashValue("ip", await getClientIp()),
  });
  if ("error" in job) return NextResponse.json({ error: job.error }, { status: 400 });
  if (job.accepted.length === 0) {
    return NextResponse.json({ error: "None of the numbers could be looked up.", rejected: job.rejected }, { status: 400 });
  }
  after(() => runBulk(job.work));
  return NextResponse.json({ id: job.jobId, accepted: job.accepted.length, rejected: job.rejected });
}
