"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      setStatus("idle");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) setError(error.message);
  }

  if (status === "sent") {
    return (
      <div role="status" className="mt-6 rounded-lg border border-line p-4 text-sm">
        <p className="font-semibold text-ink">Check your email</p>
        <p className="mt-1 text-ink-muted">
          We sent a sign-in link to <span className="text-ink">{email}</span>. It expires in 1 hour.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-3 text-sm font-semibold text-brand hover:text-brand-hover"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white font-semibold text-ink hover:border-brand"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={sendMagicLink} noValidate className="space-y-3">
        <label htmlFor={emailId} className="block text-sm font-medium">
          Email address
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-ink placeholder:text-ink-muted/80 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-11 w-full rounded-full bg-brand font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-risk-high">
          {error}
        </p>
      )}
    </div>
  );
}
