"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateTeam(form: FormData) {
  const { user } = await requireAdmin();
  const input = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(80),
      seats: z.coerce.number().int().min(1).max(500),
      monthly_allowance: z.coerce.number().int().min(0).max(1_000_000),
      add_credits: z.coerce.number().int().min(-100_000).max(100_000),
      credit_reason: z.string().trim().max(200).optional(),
      active: z.enum(["true", "false"]).transform((v) => v === "true"),
    })
    .parse(Object.fromEntries(form));
  const db = createAdminClient();
  await db
    .from("teams")
    .update({ name: input.name, seats: input.seats, monthly_allowance: input.monthly_allowance, active: input.active })
    .eq("id", input.id);
  if (input.add_credits !== 0) {
    // Atomic and audited, like user credit changes.
    await db.rpc("admin_adjust_credits", {
      p_admin_id: user.id,
      p_user_id: null,
      p_team_id: input.id,
      p_amount: input.add_credits,
      p_reason: input.credit_reason && input.credit_reason.length >= 3 ? input.credit_reason : "Admin adjustment",
    });
  }
  revalidatePath("/admin/teams");
}
