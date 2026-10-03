import type { Metadata } from "next";
import { DisputeFlow } from "./dispute-flow";

export const metadata: Metadata = {
  title: "Dispute a report",
  description: "Own a number that was reported on LookX? Verify it by SMS and ask a moderator to review the reports.",
};

export default function DisputePage() {
  return (
    <div className="hero-glow flex-1 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold text-brand">This is my number</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Dispute a report</h1>
        <p className="mt-2 text-ink-muted">
          If your number has been reported unfairly, prove it&apos;s yours with a one-time SMS code and tell us
          what&apos;s wrong. A moderator reviews every dispute. You don&apos;t need an account.
        </p>
        <DisputeFlow />
      </div>
    </div>
  );
}
