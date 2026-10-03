"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACCEPTED_IMAGE_TYPES, detectInput, validateImageFile } from "@/lib/lookup/detect";
import {
  MAX_QUESTION_LENGTH,
  REDIRECT_HINT,
  checkImageQuestion,
} from "@/lib/lookup/question";

type QuestionOption = { id: string; label: string };

type Props = {
  isSignedIn: boolean;
  /** Admin-managed questions offered alongside an image. */
  questions: QuestionOption[];
  /** Whether admins allow users to type their own question. */
  allowCustomQuestions: boolean;
};

type ApiError = { error?: string; code?: string };

/**
 * Hero search box. Auto-detects a phone number vs. an image link as the user
 * types, and accepts image uploads via button, drag-and-drop or paste.
 * For images, the user can pick a question from the admin-managed list.
 */
export function SearchBox({ isSignedIn, questions, allowCustomQuestions }: Props) {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const customId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const detected = useMemo(() => detectInput(text), [text]);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const isImageMode = Boolean(file) || detected.kind === "image_url";
  const needsAccount = isImageMode && !isSignedIn;
  const customCheck = useMemo(() => checkImageQuestion(customQuestion), [customQuestion]);
  const usingCustom = !questionId && customQuestion.trim().length > 0;

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const problem = validateImageFile(f);
    if (problem) {
      setError({ error: problem });
      return;
    }
    setError(null);
    setText("");
    setFile(f);
  }

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsAccount) {
      setError({ error: "Image lookups need a free account.", code: "needs_account" });
      return;
    }
    if (isImageMode && usingCustom && !customCheck.allowed) {
      setError({ error: "Change or remove your question to continue." });
      return;
    }

    const question = usingCustom && customCheck.allowed ? customCheck.question : undefined;
    let request: Promise<Response>;
    if (file) {
      const body = new FormData();
      body.append("image", file);
      if (questionId) body.append("question_id", questionId);
      if (question) body.append("question", question);
      request = fetch("/api/lookup/image", { method: "POST", body });
    } else if (detected.kind === "image_url") {
      request = fetch("/api/lookup/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: detected.url, question_id: questionId ?? undefined, question }),
      });
    } else if (detected.kind === "phone") {
      request = fetch("/api/lookup/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: text }),
      });
    } else {
      setError({
        error: detected.kind === "empty" ? "Enter a phone number or upload an image." : detected.message,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await request;
      const data = (await res.json().catch(() => ({}))) as ApiError & { id?: string };
      if (!res.ok || !data.id) {
        setError({ error: data.error ?? "Something went wrong. Please try again.", code: data.code });
        setSubmitting(false);
        return;
      }
      router.push(`/result/${data.id}`);
    } catch {
      setError({ error: "Network error. Check your connection and try again." });
      setSubmitting(false);
    }
  }

  const hint = (() => {
    if (file) return `Image ready: ${file.name}`;
    switch (detected.kind) {
      case "phone":
        return `Phone number detected: ${detected.formatted}`;
      case "image_url":
        return "Image link detected";
      case "invalid_phone":
      case "person_query":
        return detected.message;
      default:
        return null;
    }
  })();
  const hintIsWarning = !file && (detected.kind === "invalid_phone" || detected.kind === "person_query");

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="w-full"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pickFile(e.dataTransfer.files?.[0]);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Phone number or image link
      </label>
      <div
        className={`flex items-center gap-1 rounded-full border-2 bg-white p-1.5 pl-4 shadow-[0_10px_30px_-12px_rgb(7_122_84/0.35)] transition-colors ${
          dragging ? "border-brand-bright" : "border-mint-200 focus-within:border-brand"
        }`}
      >
        {file && previewUrl ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={previewUrl} alt="Preview of the image you selected" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            <span className="truncate text-sm text-ink">{file.name}</span>
            <button
              type="button"
              onClick={clearFile}
              className="ml-auto shrink-0 rounded-full px-2 py-1 text-sm text-ink-muted hover:text-brand"
            >
              Remove
            </button>
          </div>
        ) : (
          <input
            id={inputId}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Enter a phone number or paste an image link"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            onPaste={(e) => {
              const pasted = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
              if (pasted) { e.preventDefault(); pickFile(pasted); }
            }}
            aria-describedby={hintId}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-ink placeholder:text-ink-muted/80 focus:outline-none"
          />
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {!file && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-mint-50 hover:text-brand"
            aria-label="Upload an image"
            title="Upload an image"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <circle cx="9" cy="10" r="1.75" />
              <path d="M21 16l-5-5-8 8" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-brand px-4 font-semibold text-white hover:bg-brand-hover disabled:opacity-70 sm:px-6"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" strokeLinecap="round" />
          </svg>
          <span className="sr-only sm:not-sr-only">{submitting ? "Checking…" : "Look up"}</span>
        </button>
      </div>

      <p
        id={hintId}
        aria-live="polite"
        className={`mt-3 min-h-5 px-2 text-sm ${hintIsWarning ? "text-risk-caution" : "text-ink-muted"}`}
      >
        {hint}
      </p>

      {isImageMode && (questions.length > 0 || allowCustomQuestions) && (
        <fieldset className="mt-2 rounded-2xl border border-line bg-white/90 p-4 text-left shadow-sm">
          <legend className="sr-only">Ask about this image</legend>
          <p className="text-sm font-semibold text-ink" aria-hidden="true">
            Ask about this image <span className="font-normal text-ink-muted">(optional)</span>
          </p>
          {questions.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {questions.map((q) => {
                const selected = questionId === q.id;
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setQuestionId(selected ? null : q.id);
                        setCustomQuestion("");
                        setError(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        selected
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-mint-50 text-ink hover:border-brand"
                      }`}
                    >
                      {q.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {allowCustomQuestions && (
            <div className="mt-3">
              <label htmlFor={customId} className="text-sm text-ink-muted">
                {questions.length > 0 ? "Or ask your own question about the image" : "Your question"}
              </label>
              <textarea
                id={customId}
                rows={2}
                maxLength={MAX_QUESTION_LENGTH}
                value={customQuestion}
                onChange={(e) => {
                  setCustomQuestion(e.target.value);
                  if (e.target.value) setQuestionId(null);
                  setError(null);
                }}
                placeholder="e.g. Is this photo stolen from someone else?"
                aria-invalid={!customCheck.allowed}
                className={`mt-1 w-full resize-none rounded-xl border bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted/80 focus:outline-none ${
                  customCheck.allowed ? "border-line focus:border-brand" : "border-risk-caution"
                }`}
              />
              {!customCheck.allowed && (
                <div role="status" className="mt-2 space-y-1 rounded-xl bg-risk-caution-bg px-3 py-2 text-sm">
                  <p className="font-medium text-risk-caution">{customCheck.message}</p>
                  {customCheck.topic !== "too_long" && <p className="text-ink">{REDIRECT_HINT}</p>}
                  {customCheck.topic !== "too_long" && questions[0] && (
                    <button
                      type="button"
                      onClick={() => { setQuestionId(questions[0].id); setCustomQuestion(""); }}
                      className="mt-1 rounded-full border border-brand bg-white px-3 py-1 text-xs font-semibold text-brand hover:bg-brand-soft"
                    >
                      Ask instead: {questions[0].label}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </fieldset>
      )}

      {needsAccount && !error && (
        <p className="mt-2 px-2 text-sm text-ink-muted">
          Image lookups need a free account.{" "}
          <Link href="/login?next=/" className="font-semibold text-brand underline">Sign in</Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 px-2 text-sm font-medium text-risk-high">
          {error.error}{" "}
          {(error.code === "guest_limit" || error.code === "needs_account") && (
            <Link href="/login?next=/" className="font-semibold text-brand underline">Sign in free</Link>
          )}
          {error.code === "no_credits" && (
            <Link href="/pricing" className="font-semibold text-brand underline">Buy credits</Link>
          )}
        </p>
      )}
    </form>
  );
}
