import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Make sure a business user owns a team (created when an admin sets the Business plan). */
export async function ensureTeamForOwner(userId: string) {
  const db = createAdminClient();
  const { data: existing } = await db.from("team_members").select("team_id").eq("user_id", userId).maybeSingle();
  if (existing) return existing.team_id;
  const { data: profile } = await db.from("profiles").select("email").eq("id", userId).single();
  const domain = profile?.email?.split("@")[1]?.split(".")[0];
  const name = domain && !["gmail", "yahoo", "outlook", "hotmail", "icloud"].includes(domain)
    ? `${domain.charAt(0).toUpperCase()}${domain.slice(1)}`
    : `${profile?.email?.split("@")[0] ?? "My"}'s team`;
  const { data: team } = await db.from("teams").insert({ name: name.slice(0, 80), owner_id: userId }).select("id").single();
  if (!team) return null;
  await db.from("team_members").insert({ team_id: team.id, user_id: userId, role: "owner" });
  return team.id;
}
