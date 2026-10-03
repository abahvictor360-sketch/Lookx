import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { isProActive } from "@/lib/plans";

/**
 * Pro and Business accounts get "priority results": deeper AI analysis and
 * higher burst limits. Returns false for guests.
 */
export async function hasPriority(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from("profiles").select("plan, plan_expires_at").eq("id", userId).maybeSingle();
  return data?.plan === "business" || isProActive(data);
}
