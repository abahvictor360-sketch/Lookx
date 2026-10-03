import "server-only";

import { isSupabaseConfigured } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";
import { SUGGESTED_QUESTIONS } from "./question";

export type QuestionOption = { id: string; label: string };
export type QuestionConfig = { questions: QuestionOption[]; allowCustom: boolean };

/** Built-in defaults, used before Supabase is configured. */
const DEFAULTS: QuestionConfig = {
  questions: SUGGESTED_QUESTIONS.map((label, i) => ({ id: `default-${i}`, label })),
  allowCustom: true,
};

/** Active admin-managed image questions + whether custom questions are allowed. */
export async function getQuestionConfig(): Promise<QuestionConfig> {
  if (!isSupabaseConfigured) return DEFAULTS;
  const supabase = await createClient();
  const [questions, settings] = await Promise.all([
    supabase
      .from("image_questions")
      .select("id, label")
      .eq("active", true)
      .order("sort_order")
      .order("created_at"),
    supabase.from("site_settings").select("allow_custom_image_questions").eq("id", 1).maybeSingle(),
  ]);
  if (questions.error) return DEFAULTS;
  return {
    questions: questions.data,
    allowCustom: settings.data?.allow_custom_image_questions ?? true,
  };
}
