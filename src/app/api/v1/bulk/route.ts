import { NextResponse, after } from "next/server";
import { z } from "zod";
import { apiError, authenticateApi } from "@/lib/api/auth";
import { createBulkJob, runBulk } from "@/lib/teams/bulk";
import { MAX_BULK } from "@/lib/teams/server";

export const maxDuration = 300;

const Body = z.object({
  phones: z.array(z.string().max(32)).min(1).max(MAX_BULK * 2),
  label: z.string().trim().max(80).optional(),
});

/**
 * POST /api/v1/bulk { phones: [...], label? }
 * Up to 50 unique numbers. Returns a job id immediately; poll GET /api/v1/bulk/{id}.
 */
export async function POST(request: Request) {
  const auth = await authenticateApi(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_request", `Body must be JSON: { "phones": ["0801...", ...] } with up to ${MAX_BULK} numbers.`);

  const job = await createBulkJob({ teamId: auth.teamId, phones: parsed.data.phones, apiKeyId: auth.keyId, label: parsed.data.label, ipHash: null });
  if ("error" in job) return apiError(400, "invalid_request", job.error!);

  after(() => runBulk(job.work));
  return NextResponse.json(
    { id: job.jobId, accepted: job.accepted.map(({ input, e164, id }) => ({ input, e164, lookup_id: id })), rejected: job.rejected },
    { status: 202 },
  );
}
