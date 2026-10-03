"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  MAX_DESCRIPTION,
  MAX_EVIDENCE_BYTES,
  MIN_DESCRIPTION,
  REPORT_CATEGORIES,
  REPORT_PLATFORMS,
} from "@/lib/reports/constants";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/lookup/detect";

type Props = {
  type: "phone" | "image";
  initialPhone: string;
  phoneLabel: string | null;
  image: { lookupId: string; thumbnailUrl: string | null } | null;
};

/** Downscale a screenshot in the browser (max 2000px, JPEG) to keep uploads small. */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink-muted/80 focus:border-brand focus:outline-none";

export function ReportForm({ type, initialPhone, phoneLabel, image }: Props) {
  const ids = { phone: useId(), platform: useId(), desc: useId(), evidence: useId(), confirm: useId() };
  const [phone, setPhone] = useState(initialPhone);
  const [category, setCategory] = useState<string>("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"approved" | "pending" | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (type === "phone" && !phone.trim()) return setError("Enter the phone number you're reporting.");
    if (!category) return setError("Choose what happened.");
    if (!platform) return setError("Choose where it happened.");
    if (description.trim().length < MIN_DESCRIPTION) {
      return setError(`Please describe what happened in at least ${MIN_DESCRIPTION} characters.`);
    }
    if (!confirm) return setError("Please confirm the report is truthful.");

    setSubmitting(true);
    const body = new FormData();
    body.append("target_type", type);
    if (type === "phone") body.append("phone", phone);
    if (image) body.append("lookup_id", image.lookupId);
    body.append("category", category);
    body.append("platform", platform);
    body.append("description", description);
    body.append("confirm", "yes");
    try {
      if (evidence) {
        const small = await downscale(evidence);
        if (small.size > MAX_EVIDENCE_BYTES) throw new Error("too big");
        body.append("evidence", small, "evidence.jpg");
      }
    } catch {
      setSubmitting(false);
      return setError("We couldn't process that screenshot. Try a different image or leave it out.");
    }

    try {
      const res = await fetch("/api/report", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { status?: "approved" | "pending"; error?: string };
      if (!res.ok || !data.status) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setDone(data.status);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="text-lg font-bold text-ink">Thank you for reporting</p>
        <p className="mt-2 text-sm text-ink-muted">
          {done === "approved"
            ? "Your report is now live and will help others checking this " + (type === "phone" ? "number." : "image.")
            : "A moderator will review your report before it goes public. This usually takes less than a day."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">
            Back to search
          </Link>
          <Link href="/dashboard" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold hover:border-brand">
            View my reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      {type === "phone" ? (
        <div>
          <label htmlFor={ids.phone} className="text-sm font-semibold">Phone number</label>
          <input
            id={ids.phone}
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0801 234 5678"
            className={field}
          />
          {phoneLabel && <p className="mt-1 text-xs text-ink-muted">Reporting {phoneLabel}</p>}
        </div>
      ) : (
        image && (
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-mint-50">
              {image.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={image.thumbnailUrl} alt="The image you're reporting" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center p-1 text-center text-[10px] text-ink-muted">Image deleted after 24h</span>
              )}
            </div>
            <p className="text-sm text-ink-muted">
              You&apos;re reporting this image. Re-uploads of the same picture will show your report too.
            </p>
          </div>
        )
      )}

      <fieldset>
        <legend className="text-sm font-semibold">What happened?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {REPORT_CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${
                category === c.value ? "border-brand bg-brand-soft" : "border-line hover:border-brand"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
                className="sr-only"
              />
              <span className="font-semibold text-ink">{c.label}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{c.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={ids.platform} className="text-sm font-semibold">Where did it happen?</label>
        <select id={ids.platform} value={platform} onChange={(e) => setPlatform(e.target.value)} className={field}>
          <option value="">Choose a platform</option>
          {REPORT_PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={ids.desc} className="text-sm font-semibold">Describe what happened</label>
        <textarea
          id={ids.desc}
          rows={5}
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Advertised an iPhone on Instagram, asked for full payment by transfer, then blocked me."
          aria-describedby={`${ids.desc}-hint`}
          className={`${field} resize-y`}
        />
        <p id={`${ids.desc}-hint`} className="mt-1 flex justify-between gap-3 text-xs text-ink-muted">
          <span>Stick to facts. Don&apos;t include addresses, ID numbers or other private details.</span>
          <span aria-live="polite">{description.length}/{MAX_DESCRIPTION}</span>
        </p>
      </div>

      <div>
        <label htmlFor={ids.evidence} className="text-sm font-semibold">
          Screenshot evidence <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <input
          id={ids.evidence}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:font-semibold file:text-brand"
        />
        <p className="mt-1 text-xs text-ink-muted">Only moderators can see screenshots. They&apos;re never shown publicly.</p>
      </div>

      <label htmlFor={ids.confirm} className="flex gap-3 text-sm">
        <input
          id={ids.confirm}
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
        />
        <span>This report is truthful and based on my own experience. I understand false reports can lead to a ban.</span>
      </label>

      {error && <p role="alert" className="text-sm font-medium text-risk-high">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-hover disabled:opacity-70 sm:w-auto"
      >
        {submitting ? "Sending…" : "Submit report"}
      </button>
    </form>
  );
}
