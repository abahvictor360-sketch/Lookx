import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { ReportCategory, ReportPlatform, ReportStatus } from "@/lib/supabase/database.types";

type Admin = ReturnType<typeof createAdminClient>;

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export type DisputableReport = {
  id: string;
  category: ReportCategory;
  platform: ReportPlatform;
  excerpt: string;
  created_at: string;
  status: ReportStatus;
  /** False when it's already disputed and waiting for a moderator. */
  disputable: boolean;
};

/** Public reports for a number (approved or disputed). Never selects reporter ids. */
export async function publicReportsForNumber(db: Admin, e164: string): Promise<DisputableReport[]> {
  const { data: phone } = await db.from("phone_numbers").select("id").eq("e164_number", e164).maybeSingle();
  if (!phone) return [];
  const { data } = await db
    .from("reports")
    .select("id, category, platform, description, created_at, status")
    .eq("target_type", "phone")
    .eq("target_id", phone.id)
    .in("status", ["approved", "disputed"])
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    platform: r.platform,
    excerpt: r.description.length > 220 ? `${r.description.slice(0, 217)}…` : r.description,
    created_at: r.created_at,
    status: r.status,
    disputable: r.status === "approved",
  }));
}
