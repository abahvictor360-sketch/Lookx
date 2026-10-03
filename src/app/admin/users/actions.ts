"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureTeamForOwner } from "@/lib/teams/admin";

const id = z.string().uuid();

function refresh() {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function setBanned(form: FormData) {
  const { user } = await requireAdmin();
  const userId = id.parse(form.get("user_id"));
  const banned = form.get("banned") === "true";
  if (userId === user.id) return;
  await createAdminClient().from("profiles").update({ banned }).eq("id", userId).neq("role", "admin");
  refresh();
}

/** Set a user's plan. Pro is granted for one month from now. */
export async function setPlan(form: FormData) {
  await requireAdmin();
  const userId = id.parse(form.get("user_id"));
  const plan = z.enum(["free", "starter", "pro", "business"]).parse(form.get("plan"));
  await createAdminClient()
    .from("profiles")
    .update({
      plan,
      plan_expires_at: plan === "pro" ? new Date(Date.now() + 31 * 86_400_000).toISOString() : null,
    })
    .eq("id", userId);
  if (plan === "business") await ensureTeamForOwner(userId);
  refresh();
  revalidatePath("/admin/teams");
}

/** Add (or remove, with a negative number) paid credits, e.g. for support refunds. */
export async function adjustCredits(form: FormData) {
  await requireAdmin();
  const userId = id.parse(form.get("user_id"));
  const delta = z.coerce.number().int().min(-1000).max(1000).parse(form.get("delta"));
  const db = createAdminClient();
  const { data } = await db.from("profiles").select("credits").eq("id", userId).single();
  if (!data) return;
  await db.from("profiles").update({ credits: Math.max(0, data.credits + delta) }).eq("id", userId);
  refresh();
}
