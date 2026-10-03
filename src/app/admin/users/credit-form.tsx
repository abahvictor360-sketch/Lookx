"use client";

import { useActionState, useState } from "react";
import { adjustCredits, type CreditState } from "./actions";

const field = "rounded-full border border-line bg-white px-3 py-1.5 text-xs focus:border-brand focus:outline-none";

/**
 * Add or remove a user's paid credits, with a required reason (audited).
 * Inputs are controlled so a validation error never silently resets the
 * amount the admin typed; they clear only after a successful save.
 */
export function CreditForm({ userId, email }: { userId: string; email: string | null }) {
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState<CreditState, FormData>(async (prev, form) => {
    const result = await adjustCredits(prev, form);
    if (result.ok) {
      setAmount("10");
      setReason("");
    }
    return result;
  }, {});

  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-1">
        <input type="hidden" name="user_id" value={userId} />
        <input
          name="amount"
          type="number"
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={`Credits to add for ${email ?? "user"} (negative to remove)`}
          className={`${field} w-20`}
        />
        <input
          name="reason"
          required
          minLength={3}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason, e.g. refund"
          aria-label="Reason for the credit change"
          className={`${field} w-40`}
        />
        <button disabled={pending} className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
          {pending ? "Saving…" : Number(amount) < 0 ? "Remove credits" : "Add credits"}
        </button>
      </form>
      {(state.message || state.error) && (
        <p role={state.error ? "alert" : "status"} className={`mt-1 text-xs font-medium ${state.error ? "text-risk-high" : "text-brand"}`}>
          {state.error ?? state.message}
        </p>
      )}
    </div>
  );
}
