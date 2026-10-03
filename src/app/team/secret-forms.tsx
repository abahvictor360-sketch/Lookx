"use client";

import { useActionState, useState } from "react";
import { createApiKey, createInvite, type SecretState } from "./actions";

const input = "min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm focus:border-brand focus:outline-none";
const primary = "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-70";

/** Shows a secret once with a copy button. */
function OneTimeSecret({ state, what }: { state: SecretState; what: string }) {
  const [copied, setCopied] = useState(false);
  if (!state.secret) return null;
  return (
    <div role="status" className="mt-3 rounded-xl border border-brand bg-brand-soft p-3 text-sm">
      <p className="font-semibold text-ink">{what} for {state.label}. Copy it now: it won&apos;t be shown again.</p>
      <div className="mt-2 flex gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs">{state.secret}</code>
        <button
          type="button"
          onClick={async () => { await navigator.clipboard.writeText(state.secret!); setCopied(true); }}
          className="shrink-0 rounded-full border border-brand bg-white px-3 py-1.5 text-xs font-semibold text-brand"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function CreateKeyForm() {
  const [state, action, pending] = useActionState(createApiKey, {});
  return (
    <div>
      <form action={action} className="flex gap-2">
        <input name="name" required maxLength={60} placeholder="Key name, e.g. Rider onboarding" aria-label="API key name" className={input} />
        <button disabled={pending} className={primary}>{pending ? "Creating…" : "Create key"}</button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-risk-high">{state.error}</p>}
      <OneTimeSecret state={state} what="API key created" />
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, {});
  return (
    <div>
      <form action={action} className="flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder="colleague@company.com" aria-label="Email to invite" className={input} />
        <select name="role" defaultValue="member" aria-label="Role" className="rounded-full border border-line bg-white px-3 py-2 text-sm">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button disabled={pending} className={primary}>{pending ? "Creating…" : "Create invite link"}</button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-risk-high">{state.error}</p>}
      <OneTimeSecret state={state} what="Invite link created" />
      {state.secret && <p className="mt-1 text-xs text-ink-muted">Send it to them yourself. It works once, for that email address, for 7 days.</p>}
    </div>
  );
}
