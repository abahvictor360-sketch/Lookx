import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/teams/server";

export const metadata: Metadata = { title: "Join team", robots: { index: false } };

const MESSAGES: Record<string, string> = {
  invalid: "This invite link is invalid, expired or already used. Ask your team admin for a new one.",
  wrong_email: "This invite was sent to a different email address. Sign in with the invited address.",
  already_in_team: "You're already in a team. Leave it before joining another.",
  no_seats: "This team has no free seats. Ask your team admin to request more.",
};

export default async function JoinTeamPage({ searchParams }: PageProps<"/team/join">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const { user } = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/team/join?token=${token}`)}`);

  let error = "invalid";
  if (/^[A-Za-z0-9_-]{20,64}$/.test(token) && user.email) {
    const { data } = await createAdminClient().rpc("accept_team_invite", {
      p_token_hash: hashInviteToken(token),
      p_user_id: user.id,
      p_email: user.email,
    });
    if (data?.[0]?.ok) redirect("/team");
    error = data?.[0]?.error ?? "invalid";
  }

  return (
    <div className="hero-glow flex flex-1 items-start justify-center px-4 py-16">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-extrabold">Couldn&apos;t join the team</h1>
        <p className="mt-2 text-sm text-ink-muted">{MESSAGES[error] ?? MESSAGES.invalid}</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Back to LookX</Link>
      </div>
    </div>
  );
}
