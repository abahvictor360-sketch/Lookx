"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateDataRequest(form: FormData) {
  const { user } = await requireAdmin();
  const input = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["open", "in_progress", "closed"]),
      note: z.string().trim().max(1000).optional().transform((s) => s || null),
    })
    .parse({ id: form.get("id"), status: form.get("status"), note: form.get("note") ?? undefined });
  await createAdminClient()
    .from("data_requests")
    .update({ status: input.status, admin_note: input.note, handled_by: user.id, handled_at: new Date().toISOString() })
    .eq("id", input.id);
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}
