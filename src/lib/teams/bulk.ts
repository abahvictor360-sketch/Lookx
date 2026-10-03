import "server-only";

import { runPhonePipeline } from "@/lib/lookup/phone/pipeline";
import { createPhoneLookup } from "@/lib/lookup/phone/create";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/lookup/detect";
import type { NumberDetails } from "@/lib/lookup/phone/types";
import { MAX_BULK } from "./server";

const CONCURRENCY = 5;

export type BulkAccepted = { input: string; e164: string; id: string };
export type BulkRejected = { input: string; error: string };

/**
 * Create a bulk job: validate and de-duplicate numbers, charge and create one
 * lookup per number (stopping cleanly if the team runs out), and return the
 * work to run. Call runBulk() from after() to process it.
 */
export async function createBulkJob(input: {
  teamId: string;
  phones: string[];
  createdBy?: string | null;
  apiKeyId?: string | null;
  label?: string | null;
  ipHash: string | null;
}) {
  const rejected: BulkRejected[] = [];
  const unique = new Map<string, string>(); // e164 -> original input
  for (const raw of input.phones.map((p) => p.trim()).filter(Boolean)) {
    const n = normalizePhone(raw);
    if (!n) rejected.push({ input: raw.slice(0, 40), error: "invalid_phone" });
    else if (!unique.has(n.e164)) unique.set(n.e164, raw);
  }
  if (unique.size > MAX_BULK) {
    return { error: `A bulk job can contain at most ${MAX_BULK} numbers.` } as const;
  }

  const db = createAdminClient();
  const { data: job, error } = await db
    .from("bulk_jobs")
    .insert({
      team_id: input.teamId,
      created_by: input.createdBy ?? null,
      api_key_id: input.apiKeyId ?? null,
      label: input.label ?? null,
      total: unique.size,
    })
    .select("id")
    .single();
  if (error || !job) return { error: "Couldn't create the bulk job." } as const;

  const accepted: BulkAccepted[] = [];
  const work: { id: string; queryHash: string; details: NumberDetails }[] = [];
  for (const [e164, raw] of unique) {
    const created = await createPhoneLookup({
      phone: e164,
      userId: input.createdBy ?? null,
      teamId: input.teamId,
      ipHash: input.ipHash,
      apiKeyId: input.apiKeyId ?? null,
      bulkJobId: job.id,
    });
    if (created.ok) {
      accepted.push({ input: raw, e164, id: created.id });
      work.push({ id: created.id, queryHash: created.queryHash, details: created.details });
    } else {
      rejected.push({ input: raw, error: created.code });
      if (created.code === "no_credits" || created.code === "team_inactive") {
        // Out of allowance: reject the rest without trying.
        for (const [e2, r2] of unique) {
          if (!accepted.some((a) => a.e164 === e2) && !rejected.some((r) => r.input === r2)) rejected.push({ input: r2, error: created.code });
        }
        break;
      }
    }
  }
  if (accepted.length !== unique.size) await db.from("bulk_jobs").update({ total: accepted.length }).eq("id", job.id);

  return { jobId: job.id, accepted, rejected, work } as const;
}

/** Run the pipelines with bounded concurrency (call inside after()). */
export async function runBulk(work: { id: string; queryHash: string; details: NumberDetails }[]) {
  let next = 0;
  const worker = async () => {
    while (next < work.length) {
      const w = work[next++];
      await runPhonePipeline(w.id, w.queryHash, w.details, { priority: true });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, work.length) }, worker));
}
