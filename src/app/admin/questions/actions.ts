"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { checkImageQuestion, REDIRECT_HINT } from "@/lib/lookup/question";
import { createClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const QuestionInput = z.object({
  label: z.string().trim().min(3, "Questions need at least 3 characters.").max(120, "Keep questions under 120 characters."),
  guidance: z.string().trim().max(500, "Keep guidance under 500 characters.").optional(),
});

function refresh() {
  revalidatePath("/admin/questions");
  revalidatePath("/");
}

/** Admin-written questions go through the same guard as user questions. */
function guardError(label: string) {
  const check = checkImageQuestion(label);
  if (check.allowed) return null;
  return `${check.message} Admins can't add questions about the person in a photo either. ${REDIRECT_HINT}`;
}

export async function addQuestion(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const parsed = QuestionInput.safeParse({
    label: form.get("label"),
    guidance: form.get("guidance") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const blocked = guardError(parsed.data.label);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("image_questions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("image_questions").insert({
    label: parsed.data.label,
    guidance: parsed.data.guidance ?? null,
    sort_order: (last?.sort_order ?? 0) + 10,
    created_by: user.id,
  });
  if (error) return { error: "Couldn't save the question." };
  refresh();
  return { ok: true };
}

export async function updateQuestion(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(form.get("id"));
  const parsed = QuestionInput.safeParse({
    label: form.get("label"),
    guidance: form.get("guidance") || undefined,
  });
  if (!id.success) return { error: "Unknown question." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const blocked = guardError(parsed.data.label);
  if (blocked) return { error: blocked };

  const { error } = await (await createClient())
    .from("image_questions")
    .update({ label: parsed.data.label, guidance: parsed.data.guidance ?? null })
    .eq("id", id.data);
  if (error) return { error: "Couldn't save the question." };
  refresh();
  return { ok: true };
}

export async function setQuestionActive(id: string, active: boolean) {
  await requireAdmin();
  await (await createClient()).from("image_questions").update({ active }).eq("id", z.string().uuid().parse(id));
  refresh();
}

export async function deleteQuestion(id: string) {
  await requireAdmin();
  await (await createClient()).from("image_questions").delete().eq("id", z.string().uuid().parse(id));
  refresh();
}

/** Swap a question's position with its neighbour. */
export async function moveQuestion(id: string, direction: "up" | "down") {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("image_questions")
    .select("id, sort_order")
    .order("sort_order")
    .order("created_at");
  if (!data) return;
  const i = data.findIndex((q) => q.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= data.length) return;
  // Re-number everything so ties can't block a move.
  const ordered = [...data];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  await Promise.all(
    ordered.map((q, idx) => supabase.from("image_questions").update({ sort_order: (idx + 1) * 10 }).eq("id", q.id)),
  );
  refresh();
}

export async function setAllowCustomQuestions(allow: boolean) {
  await requireAdmin();
  await (await createClient())
    .from("site_settings")
    .update({ allow_custom_image_questions: allow, updated_at: new Date().toISOString() })
    .eq("id", 1);
  refresh();
}
