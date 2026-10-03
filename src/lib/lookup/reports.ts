import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { LookupType } from "@/lib/supabase/database.types";
import type { ReportsSection } from "./phone/types";

const RECENT_DAYS = 14;

/** Approved community reports for a phone number or image. Never selects reporter ids. */
export async function getApprovedReports(
  db: ReturnType<typeof createAdminClient>,
  targetType: LookupType,
  targetId: string,
): Promise<ReportsSection> {
  const { data, error } = await db
    .from("reports")
    .select("category, platform, description, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const since = Date.now() - RECENT_DAYS * 86_400_000;
  const byCategory: ReportsSection["byCategory"] = {};
  for (const r of data) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;

  return {
    total: data.length,
    byCategory,
    recentCount: data.filter((r) => Date.parse(r.created_at) >= since).length,
    recent: data.slice(0, 3).map((r) => ({
      category: r.category,
      platform: r.platform,
      excerpt: r.description.length > 220 ? `${r.description.slice(0, 217)}…` : r.description,
      created_at: r.created_at,
    })),
  };
}
