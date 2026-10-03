"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVIDENCE_BUCKET } from "@/lib/reports/server";

const note = z.string().trim().max(500).optional().transform((s) => s || null);

function refresh() {
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

/** Approve or reject a pending report. Rejected reports' evidence is deleted. */
export async function moderateReport(form: FormData) {
  const { user } = await requireAdmin();
  const input = z
    .object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]), note })
    .parse({ id: form.get("id"), decision: form.get("decision"), note: form.get("note") ?? undefined });

  const db = createAdminClient();
  const { data: report } = await db
    .from("reports")
    .update({
      status: input.decision === "approve" ? "approved" : "rejected",
      moderated_by: user.id,
      moderated_at: new Date().toISOString(),
      moderation_note: input.note,
    })
    .eq("id", input.id)
    .eq("status", "pending")
    .select("evidence_path")
    .maybeSingle();

  if (report?.evidence_path && input.decision === "reject") {
    await db.storage.from(EVIDENCE_BUCKET).remove([report.evidence_path]);
    await db.from("reports").update({ evidence_path: null }).eq("id", input.id);
  }
  refresh();
}

/**
 * Resolve an open dispute.
 * keep   -> dispute rejected, report back to approved
 * remove -> dispute upheld, report rejected (no longer public)
 */
export async function resolveDispute(form: FormData) {
  const { user } = await requireAdmin();
  const input = z
    .object({ reportId: z.string().uuid(), decision: z.enum(["keep", "remove"]), note })
    .parse({ reportId: form.get("report_id"), decision: form.get("decision"), note: form.get("note") ?? undefined });

  const db = createAdminClient();
  const now = new Date().toISOString();
  await db
    .from("disputes")
    .update({ status: input.decision === "keep" ? "rejected" : "upheld", resolved_by: user.id, resolved_at: now })
    .eq("report_id", input.reportId)
    .eq("status", "open");
  const { data: report } = await db
    .from("reports")
    .update({
      status: input.decision === "keep" ? "approved" : "rejected",
      moderated_by: user.id,
      moderated_at: now,
      moderation_note: input.note,
    })
    .eq("id", input.reportId)
    .eq("status", "disputed")
    .select("evidence_path")
    .maybeSingle();

  if (report?.evidence_path && input.decision === "remove") {
    await db.storage.from(EVIDENCE_BUCKET).remove([report.evidence_path]);
    await db.from("reports").update({ evidence_path: null }).eq("id", input.reportId);
  }
  refresh();
}

/** Ban a user for abusing reports, and reject their pending reports. */
export async function banReporter(form: FormData) {
  const { user } = await requireAdmin();
  const userId = z.string().uuid().parse(form.get("user_id"));
  if (userId === user.id) return;

  const db = createAdminClient();
  await db.from("profiles").update({ banned: true }).eq("id", userId).neq("role", "admin");
  await db
    .from("reports")
    .update({
      status: "rejected",
      moderated_by: user.id,
      moderated_at: new Date().toISOString(),
      moderation_note: "Reporter banned",
    })
    .eq("reporter_id", userId)
    .eq("status", "pending");
  refresh();
}
