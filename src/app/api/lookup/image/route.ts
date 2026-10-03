import { NextResponse } from "next/server";
import { checkImageQuestion, REDIRECT_HINT } from "@/lib/lookup/question";

/**
 * POST /api/lookup/image
 * Accepts multipart (`image` file) or JSON (`url`), plus an optional `question`.
 *
 * Phase 1: enforces the question boundary server-side. Upload, reverse image
 * search, EXIF and AI checks arrive in Phase 3.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let question: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const value = form?.get("question");
    question = typeof value === "string" ? value : null;
  } else {
    const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
    question = typeof body?.question === "string" ? body.question : null;
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

  return NextResponse.json({ error: "Image lookups aren't live yet." }, { status: 501 });
}
