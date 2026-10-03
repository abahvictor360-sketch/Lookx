"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/public-env";
import { INVITE_TTL_DAYS, generateApiKey, generateInviteToken, requireTeam } from "@/lib/teams/server";

export type SecretState = { error?: string; secret?: string; label?: string };

/** Create an API key. The full key is returned ONCE; only its hash is stored. */
export async function createApiKey(_prev: SecretState, form: FormData): Promise<SecretState> {
  const { user, team } = await requireTeam({ manage: true });
  const name = z.string().trim().min(1, "Give the key a name.").max(60).safeParse(form.get("name"));
  if (!name.success) return { error: name.error.issues[0].message };

  const db = createAdminClient();
  const { count } = await db.from("api_keys").select("id", { count: "exact", head: true }).eq("team_id", team.id).is("revoked_at", null);
  if ((count ?? 0) >= 10) return { error: "Revoke an unused key first (maximum 10 active keys)." };

  const k = generateApiKey();
  const { error } = await db.from("api_keys").insert({ team_id: team.id, name: name.data, prefix: k.prefix, key_hash: k.hash, created_by: user.id });
  if (error) return { error: "Couldn't create the key." };
  revalidatePath("/team");
  return { secret: k.key, label: name.data };
}

export async function revokeApiKey(form: FormData) {
  const { team } = await requireTeam({ manage: true });
  const id = z.string().uuid().parse(form.get("id"));
  await createAdminClient().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("team_id", team.id);
  revalidatePath("/team");
}

/** Invite by email. Returns a one-time link to share (we don't send email ourselves). */
export async function createInvite(_prev: SecretState, form: FormData): Promise<SecretState> {
  const { user, team } = await requireTeam({ manage: true });
  const input = z
    .object({ email: z.string().trim().toLowerCase().email("Enter a valid email."), role: z.enum(["member", "admin"]) })
    .safeParse({ email: form.get("email"), role: form.get("role") });
  if (!input.success) return { error: input.error.issues[0].message };

  const db = createAdminClient();
  const [{ count: members }, { count: pending }] = await Promise.all([
    db.from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", team.id),
    db.from("team_invites").select("id", { count: "exact", head: true }).eq("team_id", team.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  if ((members ?? 0) + (pending ?? 0) >= team.seats) return { error: `All ${team.seats} seats are used or invited. Ask LookX for more seats.` };

  const t = generateInviteToken();
  const { error } = await db.from("team_invites").insert({
    team_id: team.id,
    email: input.data.email,
    role: input.data.role,
    token_hash: t.hash,
    created_by: user.id,
    expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (error) return { error: "Couldn't create the invite." };
  revalidatePath("/team");
  return { secret: `${publicEnv.siteUrl.replace(/\/$/, "")}/team/join?token=${t.token}`, label: input.data.email };
}

export async function revokeInvite(form: FormData) {
  const { team } = await requireTeam({ manage: true });
  const id = z.string().uuid().parse(form.get("id"));
  await createAdminClient().from("team_invites").delete().eq("id", id).eq("team_id", team.id).is("accepted_at", null);
  revalidatePath("/team");
}

export async function removeMember(form: FormData) {
  const { team, user } = await requireTeam({ manage: true });
  const userId = z.string().uuid().parse(form.get("user_id"));
  if (userId === team.owner_id || userId === user.id) return; // owner can't be removed; use "leave" for yourself
  await createAdminClient().from("team_members").delete().eq("team_id", team.id).eq("user_id", userId).neq("role", "owner");
  revalidatePath("/team");
}
