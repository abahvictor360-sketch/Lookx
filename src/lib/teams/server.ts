import "server-only";

import { randomBytes } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { hashValue } from "@/lib/hash";
import type { Team, TeamRole } from "@/lib/supabase/database.types";

export const MAX_BULK = 50;
export const INVITE_TTL_DAYS = 7;

/** The team a user belongs to (at most one), with their role. */
export async function getMembership(userId: string): Promise<{ team: Team; role: TeamRole } | null> {
  const db = createAdminClient();
  const { data: m } = await db.from("team_members").select("team_id, role").eq("user_id", userId).maybeSingle();
  if (!m) return null;
  const { data: team } = await db.from("teams").select("*").eq("id", m.team_id).single();
  return team ? { team, role: m.role } : null;
}

/** For team pages and actions. Non-members get a 404; managers-only pages require owner/admin. */
export async function requireTeam(opts: { manage?: boolean } = {}) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login?next=/team");
  const membership = await getMembership(user.id);
  if (!membership) notFound();
  if (opts.manage && membership.role === "member") notFound();
  return { user, ...membership, canManage: membership.role !== "member" };
}

/** Lookups billed to the team this calendar month. */
export async function teamUsageThisMonth(teamId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await createAdminClient()
    .from("lookups")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("billing", "team")
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

// ---- API keys -----------------------------------------------------------------

/** New API key. Returned once; only its keyed hash is stored. */
export function generateApiKey() {
  const key = `lx_live_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export function hashApiKey(key: string) {
  return hashValue("api_key", key);
}

// ---- Invites ------------------------------------------------------------------

export function generateInviteToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashValue("team_invite", token) };
}

export function hashInviteToken(token: string) {
  return hashValue("team_invite", token);
}
