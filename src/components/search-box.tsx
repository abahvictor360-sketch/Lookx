"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ACCEPTED_IMAGE_TYPES,
  detectInput,
  validateImageFile,
} from "@/lib/lookup/detect";

type Props = { isSignedIn: boolean };

/**
 * Hero search box. Auto-detects a phone number vs. an image link as the user
 * types, and accepts image uploads via button, drag-and-drop or paste.
 */
export function SearchBox({ isSignedIn }: Props) {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const detected = useMemo(() => detectInput(text), [text]);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const isImageMode = Boolean(file) || detected.kind === "image_url";
  const needsAccount = isImageMode && !isSignedIn;

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const problem = validateImageFile(f);
    if (problem) {
      setError(problem);
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
      setError("Image lookups need a free account. Sign in to continue.");
      return;
    }

    let request: Promise<Response>;
    if (file) {
      const body = new FormData();
      body.append("image", file);
      request = fetch("/api/lookup/image", { method: "POST", body });
    } else if (detected.kind === "image_url") {
      request = fetch("/api/lookup/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: detected.url }),
      });
    } else if (detected.kind === "phone") {
      request = fetch("/api/lookup/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: text }),
      });
    } else {
      setError(
        detected.kind === "empty"
          ? "Enter a phone number or upload an image."
          : detected.message,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await request;
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(`/result/${data.id}`);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
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
        return "Try 08012345678, +234 801 234 5678, or upload a photo";
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
        className={`flex items-center gap-2 rounded-2xl border bg-navy-800 p-2 shadow-lg shadow-black/30 transition-colors ${
          dragging ? "border-accent" : "border-navy-600 focus-within:border-accent"
        }`}
      >
        {file && previewUrl ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 pl-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              src={previewUrl}
              alt="Preview of the image you selected"
              className="h-11 w-11 shrink-0 rounded-lg object-cover"
            />
            <span className="truncate text-sm text-ink">{file.name}</span>
            <button
              type="button"
              onClick={clearFile}
              className="ml-auto shrink-0 rounded-md px-2 py-1 text-sm text-ink-muted hover:text-ink"
            >
              Remove
            </button>
          </div>
        ) : (
          <input
            id={inputId}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Phone number or image link"
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            onPaste={(e) => {
              const pasted = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
              if (pasted) { e.preventDefault(); pickFile(pasted); }
            }}
            aria-describedby={hintId}
            className="min-w-0 flex-1 bg-transparent px-2 py-3 text-base text-ink placeholder:text-ink-muted focus:outline-none sm:text-lg"
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-navy-700 hover:text-ink"
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
          className="h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60 sm:px-6"
        >
          {submitting ? "Checking…" : "Look up"}
        </button>
      </div>

      <p
        id={hintId}
        aria-live="polite"
        className={`mt-3 min-h-5 px-1 text-sm ${hintIsWarning ? "text-risk-caution" : "text-ink-muted"}`}
      >
        {hint}
      </p>

      {needsAccount && !error && (
        <p className="mt-1 px-1 text-sm text-ink-muted">
          Image lookups need a free account.{" "}
          <Link href="/login?next=/" className="font-semibold text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 px-1 text-sm text-risk-high">
          {error}{" "}
          {needsAccount && (
            <Link href="/login?next=/" className="font-semibold text-accent underline">
              Sign in
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
