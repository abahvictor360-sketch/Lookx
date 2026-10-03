"use client";

import { useActionState, useState, useTransition } from "react";
import type { ImageQuestion } from "@/lib/supabase/database.types";
import { checkImageQuestion } from "@/lib/lookup/question";
import {
  addQuestion,
  deleteQuestion,
  moveQuestion,
  setAllowCustomQuestions,
  setQuestionActive,
  updateQuestion,
  type FormState,
} from "./actions";

const input =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted/80 focus:border-brand focus:outline-none";

function QuestionFields({ defaults }: { defaults?: Pick<ImageQuestion, "label" | "guidance"> }) {
  const [label, setLabel] = useState(defaults?.label ?? "");
  const check = checkImageQuestion(label);
  return (
    <>
      <label className="block text-sm font-medium">
        Question shown to users
        <input
          name="label"
          required
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Is this product photo copied from another seller?"
          className={`mt-1 ${input} ${check.allowed ? "" : "border-risk-caution"}`}
        />
      </label>
      {!check.allowed && <p className="text-sm text-risk-caution">{check.message}</p>}
      <label className="block text-sm font-medium">
        Guidance for the AI <span className="font-normal text-ink-muted">(optional, not shown to users)</span>
        <textarea
          name="guidance"
          rows={2}
          maxLength={500}
          defaultValue={defaults?.guidance ?? ""}
          placeholder="How should LookX answer this? e.g. Compare marketplace listings that use the same image."
          className={`mt-1 resize-none ${input}`}
        />
      </label>
    </>
  );
}

function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="text-sm font-medium text-risk-high">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-brand">Saved.</p>;
  return null;
}

function AddQuestionForm() {
  // Bumping the key after a successful add clears the form fields.
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await addQuestion(prev, form);
    if (result.ok) setFormKey((k) => k + 1);
    return result;
  }, {});
  return (
    <form action={action} key={formKey} className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="font-bold">Add a question</h2>
      <QuestionFields />
      <FormMessage state={state} />
      <button disabled={pending} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
        {pending ? "Adding…" : "Add question"}
      </button>
    </form>
  );
}

function QuestionRow({ q, first, last }: { q: ImageQuestion; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, saving] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await updateQuestion(prev, form);
    if (result.ok) setEditing(false);
    return result;
  }, {});
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); });

  return (
    <li className={`rounded-2xl border border-line bg-white p-4 shadow-sm ${q.active ? "" : "opacity-70"}`}>
      {editing ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={q.id} />
          <QuestionFields defaults={q} />
          <FormMessage state={state} />
          <div className="flex gap-2">
            <button disabled={saving} className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-line px-4 py-1.5 text-sm">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {q.label}
              {!q.active && <span className="ml-2 rounded bg-mint-100 px-1.5 py-0.5 text-xs font-medium text-ink-muted">Hidden</span>}
            </p>
            {q.guidance && <p className="mt-1 text-sm text-ink-muted">AI guidance: {q.guidance}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5 text-sm" aria-busy={pending}>
            <button type="button" disabled={first || pending} onClick={() => run(() => moveQuestion(q.id, "up"))} aria-label={`Move "${q.label}" up`} className="rounded-full border border-line px-2.5 py-1 disabled:opacity-40">↑</button>
            <button type="button" disabled={last || pending} onClick={() => run(() => moveQuestion(q.id, "down"))} aria-label={`Move "${q.label}" down`} className="rounded-full border border-line px-2.5 py-1 disabled:opacity-40">↓</button>
            <button type="button" disabled={pending} onClick={() => run(() => setQuestionActive(q.id, !q.active))} className="rounded-full border border-line px-3 py-1 hover:border-brand">
              {q.active ? "Hide" : "Show"}
            </button>
            <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-line px-3 py-1 hover:border-brand">Edit</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete "${q.label}"?`)) run(() => deleteQuestion(q.id));
              }}
              className="rounded-full border border-line px-3 py-1 text-risk-high hover:border-risk-high"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function QuestionManager({ questions, allowCustom }: { questions: ImageQuestion[]; allowCustom: boolean }) {
  const [pending, startTransition] = useTransition();
  const activeCount = questions.filter((q) => q.active).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Image questions</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          These are the questions users can pick when they look up an image. Questions about the
          person in a photo (who they are, whether they&apos;re married, where they live, and similar)
          are blocked automatically and can&apos;t be added here.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-mint-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Let users type their own question</p>
          <p className="text-sm text-ink-muted">
            When off, users can only pick from the list below. Typed questions still go through the
            safety check.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowCustom}
          disabled={pending}
          onClick={() => startTransition(async () => { await setAllowCustomQuestions(!allowCustom); })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${allowCustom ? "bg-brand" : "bg-line"}`}
        >
          <span className="sr-only">Allow custom questions</span>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${allowCustom ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <section aria-label="Current questions" className="space-y-3">
        <p className="text-sm text-ink-muted">
          {activeCount} of {questions.length} question{questions.length === 1 ? "" : "s"} visible to users.
        </p>
        {questions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-5 text-sm text-ink-muted">No questions yet.</p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q, i) => (
              <QuestionRow key={q.id} q={q} first={i === 0} last={i === questions.length - 1} />
            ))}
          </ul>
        )}
      </section>

      <AddQuestionForm />
    </div>
  );
}
