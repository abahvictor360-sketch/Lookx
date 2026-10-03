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

export type CreditState = { ok?: boolean; message?: string; error?: string };

/**
 * Add (or remove, with a negative number) paid credits, e.g. a goodwill gift
 * or a refund for a failed lookup. Atomic and logged with a reason.
 */
export async function adjustCredits(_prev: CreditState, form: FormData): Promise<CreditState> {
  const { user } = await requireAdmin();
  const input = z
    .object({
      user_id: z.string().uuid(),
      amount: z.coerce
        .number({ message: "Enter a number of credits." })
        .int("Use a whole number.")
        .min(-10_000, "That's too many to remove at once.")
        .max(10_000, "That's too many to add at once.")
        .refine((n) => n !== 0, "Enter a number other than 0."),
      reason: z.string().trim().min(3, "Add a short reason (at least 3 characters).").max(200),
    })
    .safeParse({ user_id: form.get("user_id"), amount: form.get("amount"), reason: form.get("reason") });
  if (!input.success) return { error: input.error.issues[0].message };

  const { data, error } = await createAdminClient().rpc("admin_adjust_credits", {
    p_admin_id: user.id,
    p_user_id: input.data.user_id,
    p_team_id: null,
    p_amount: input.data.amount,
    p_reason: input.data.reason,
  });
  const r = data?.[0];
  if (error || !r?.ok) return { error: "Couldn't update credits. Please try again." };

  refresh();
  const verb = r.applied >= 0 ? `Added ${r.applied}` : `Removed ${-r.applied}`;
  return { ok: true, message: `${verb} credit${Math.abs(r.applied) === 1 ? "" : "s"}. New balance: ${r.balance}.` };
}
