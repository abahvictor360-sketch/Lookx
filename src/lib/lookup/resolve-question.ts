import "server-only";

import { isSupabaseConfigured } from "@/lib/public-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkImageQuestion, REDIRECT_HINT } from "./question";
import { getQuestionConfig } from "./questions-config";

export type ResolvedQuestion = {
  label: string;
  source: "preset" | "custom";
  /** Admin guidance for the AI. Server-side only, never sent to the browser. */
  guidance: string | null;
} | null;

type Result =
  | { ok: true; question: ResolvedQuestion }
  | { ok: false; code: string; error: string };

const UUID = /^[0-9a-f-]{36}$/i;

/** Validate the optional question sent with an image lookup. */
export async function resolveImageQuestion(questionId: string | null, text: string | null): Promise<Result> {
  if (questionId) {
    // Built-in defaults (before Supabase is configured) use ids like "default-0".
    if (!UUID.test(questionId) || !isSupabaseConfigured) {
      const preset = (await getQuestionConfig()).questions.find((q) => q.id === questionId);
      return preset
        ? { ok: true, question: { label: preset.label, source: "preset", guidance: null } }
        : { ok: false, code: "question_invalid", error: "That question is no longer available." };
    }
    const { data } = await createAdminClient()
      .from("image_questions")
      .select("label, guidance")
      .eq("id", questionId)
      .eq("active", true)
      .maybeSingle();
    if (!data) return { ok: false, code: "question_invalid", error: "That question is no longer available." };
    return { ok: true, question: { label: data.label, source: "preset", guidance: data.guidance } };
  }

  if (text?.trim()) {
    const { allowCustom } = await getQuestionConfig();
    if (!allowCustom) {
      return { ok: false, code: "question_custom_disabled", error: "Please pick one of the suggested questions." };
    }
    const check = checkImageQuestion(text);
    if (!check.allowed) {
      return {
        ok: false,
        code: "question_out_of_scope",
        error: check.topic === "too_long" ? check.message : `${check.message} ${REDIRECT_HINT}`,
      };
    }
    return { ok: true, question: { label: check.question, source: "custom", guidance: null } };
  }

  return { ok: true, question: null };
}
