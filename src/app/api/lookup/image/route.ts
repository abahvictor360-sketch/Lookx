import { NextResponse } from "next/server";
import { checkImageQuestion, REDIRECT_HINT } from "@/lib/lookup/question";
import { getQuestionConfig } from "@/lib/lookup/questions-config";

/**
 * POST /api/lookup/image
 * Accepts multipart (`image` file) or JSON (`url`), plus an optional question:
 * either `question_id` (an admin-managed preset) or `question` (free text, only
 * when admins allow custom questions).
 *
 * Phase 2: enforces the question rules server-side. Upload, reverse image
 * search, EXIF and AI checks arrive in Phase 3.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let questionId: string | null = null;
  let question: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const id = form?.get("question_id");
    const text = form?.get("question");
    questionId = typeof id === "string" && id ? id : null;
    question = typeof text === "string" ? text : null;
  } else {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    questionId = typeof body?.question_id === "string" && body.question_id ? body.question_id : null;
    question = typeof body?.question === "string" ? body.question : null;
  }

  const config = await getQuestionConfig();
  let resolvedQuestion: string | null = null;

  if (questionId) {
    const preset = config.questions.find((q) => q.id === questionId);
    if (!preset) {
      return NextResponse.json({ error: "That question is no longer available.", code: "question_invalid" }, { status: 422 });
    }
    resolvedQuestion = preset.label;
  } else if (question?.trim()) {
    if (!config.allowCustom) {
      return NextResponse.json(
        { error: "Please pick one of the suggested questions.", code: "question_custom_disabled" },
        { status: 422 },
      );
    }
    const check = checkImageQuestion(question);
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.topic === "too_long" ? check.message : `${check.message} ${REDIRECT_HINT}`,
          code: "question_out_of_scope",
        },
        { status: 422 },
      );
    }
    resolvedQuestion = check.question;
  }
  void resolvedQuestion; // stored on the lookup in Phase 3

  return NextResponse.json({ error: "Image lookups aren't live yet." }, { status: 501 });
}
