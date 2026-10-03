import { createClient } from "@/lib/supabase/server";
import { QuestionManager } from "./question-manager";

export default async function AdminQuestionsPage() {
  const supabase = await createClient();
  const [{ data: questions }, { data: settings }] = await Promise.all([
    supabase.from("image_questions").select("*").order("sort_order").order("created_at"),
    supabase.from("site_settings").select("allow_custom_image_questions").eq("id", 1).maybeSingle(),
  ]);

  return (
    <QuestionManager
      questions={questions ?? []}
      allowCustom={settings?.allow_custom_image_questions ?? true}
    />
  );
}
