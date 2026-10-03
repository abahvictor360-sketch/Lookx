import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { LookupType } from "@/lib/supabase/database.types";
import type { ReportsSection } from "./phone/types";

const RECENT_DAYS = 14;

/**
 * Public community reports for a phone number or image: approved reports plus
 * disputed ones (still shown, labelled, until an admin decides). Pending and
 * rejected reports are never public. Never selects reporter ids.
 */
export async function getPublicReports(
  db: ReturnType<typeof createAdminClient>,
  targetType: LookupType,
  targetId: string,
): Promise<ReportsSection> {
  const { data, error } = await db
    .from("reports")
    .select("category, platform, description, created_at, status")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .in("status", ["approved", "disputed"])
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
    disputedCount: data.filter((r) => r.status === "disputed").length,
    recent: data.slice(0, 3).map((r) => ({
      category: r.category,
      platform: r.platform,
      excerpt: r.description.length > 220 ? `${r.description.slice(0, 217)}…` : r.description,
      created_at: r.created_at,
      disputed: r.status === "disputed",
    })),
  };
}
