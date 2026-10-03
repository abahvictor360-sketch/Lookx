import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Report, ReportStatus } from "@/lib/supabase/database.types";
import { IMAGE_BUCKET } from "@/lib/lookup/image/storage";
import { EVIDENCE_BUCKET } from "./server";

export type QueueTab = "pending" | "disputed" | "recent";

export type QueueItem = Report & {
  target: { kind: "phone"; label: string } | { kind: "image"; thumbnailUrl: string | null; reportCount: number };
  evidenceUrl: string | null;
  reporter: { id: string; email: string | null; accountDays: number; approved: number; rejected: number; banned: boolean };
  dispute: { reason: string; claimantPhone: string; verified: boolean; created_at: string } | null;
};

/** Loads a moderation queue tab with everything a moderator needs. Admin only. */
export async function loadQueue(tab: QueueTab): Promise<QueueItem[]> {
  const db = createAdminClient();
  let query = db.from("reports").select("*").limit(50);
  if (tab === "pending") query = query.eq("status", "pending").order("created_at", { ascending: true });
  else if (tab === "disputed") query = query.eq("status", "disputed").order("created_at", { ascending: true });
  else query = query.in("status", ["approved", "rejected"] as ReportStatus[]).not("moderated_at", "is", null).order("moderated_at", { ascending: false });

  const { data: reports } = await query;
  if (!reports?.length) return [];

  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
  const phoneIds = reports.filter((r) => r.target_type === "phone").map((r) => r.target_id);
  const imageIds = reports.filter((r) => r.target_type === "image").map((r) => r.target_id);

  const [profiles, history, phones, images, disputes] = await Promise.all([
    db.from("profiles").select("id, email, created_at, banned").in("id", reporterIds),
    db.from("reports").select("reporter_id, status").in("reporter_id", reporterIds).in("status", ["approved", "rejected"]),
    phoneIds.length ? db.from("phone_numbers").select("id, e164_number").in("id", phoneIds) : Promise.resolve({ data: [] }),
    imageIds.length ? db.from("images").select("id, storage_path, report_count").in("id", imageIds) : Promise.resolve({ data: [] }),
    tab === "disputed"
      ? db.from("disputes").select("report_id, reason, claimant_phone, verified, created_at").eq("status", "open").in("report_id", reports.map((r) => r.id))
      : Promise.resolve({ data: [] }),
  ]);

  const sign = async (bucket: string, path: string | null) => {
    if (!path) return null;
    const { data } = await db.storage.from(bucket).createSignedUrl(path, 600);
    return data?.signedUrl ?? null;
  };

  return Promise.all(
    reports.map(async (r) => {
      const p = profiles.data?.find((x) => x.id === r.reporter_id);
      const mine = (history.data ?? []).filter((h) => h.reporter_id === r.reporter_id);
      const d = disputes.data?.find((x) => x.report_id === r.id);
      let target: QueueItem["target"];
      if (r.target_type === "phone") {
        target = { kind: "phone", label: phones.data?.find((x) => x.id === r.target_id)?.e164_number ?? "Unknown number" };
      } else {
        const img = images.data?.find((x) => x.id === r.target_id);
        target = { kind: "image", thumbnailUrl: await sign(IMAGE_BUCKET, img?.storage_path ?? null), reportCount: img?.report_count ?? 0 };
      }
      return {
        ...r,
        target,
        evidenceUrl: await sign(EVIDENCE_BUCKET, r.evidence_path),
        reporter: {
          id: r.reporter_id,
          email: p?.email ?? null,
          accountDays: p ? Math.floor((Date.now() - Date.parse(p.created_at)) / 86_400_000) : 0,
          approved: mine.filter((h) => h.status === "approved").length,
          rejected: mine.filter((h) => h.status === "rejected").length,
          banned: p?.banned ?? false,
        },
        dispute: d ? { reason: d.reason, claimantPhone: d.claimant_phone, verified: d.verified, created_at: d.created_at } : null,
      };
    }),
  );
}

export async function queueCounts() {
  const db = createAdminClient();
  const [pending, disputed] = await Promise.all([
    db.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("reports").select("id", { count: "exact", head: true }).eq("status", "disputed"),
  ]);
  return { pending: pending.count ?? 0, disputed: disputed.count ?? 0 };
}
