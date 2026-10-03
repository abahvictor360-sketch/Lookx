"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateTeam(form: FormData) {
  await requireAdmin();
  const input = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(80),
      seats: z.coerce.number().int().min(1).max(500),
      monthly_allowance: z.coerce.number().int().min(0).max(1_000_000),
      add_credits: z.coerce.number().int().min(-100_000).max(100_000),
      active: z.enum(["true", "false"]).transform((v) => v === "true"),
    })
    .parse(Object.fromEntries(form));
  const db = createAdminClient();
  const { data: team } = await db.from("teams").select("credits").eq("id", input.id).single();
  if (!team) return;
  await db
    .from("teams")
    .update({
      name: input.name,
      seats: input.seats,
      monthly_allowance: input.monthly_allowance,
      credits: Math.max(0, team.credits + input.add_credits),
      active: input.active,
    })
    .eq("id", input.id);
  revalidatePath("/admin/teams");
}
