import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeam, teamUsageThisMonth } from "@/lib/teams/server";
import { removeMember, revokeApiKey, revokeInvite } from "./actions";
import { CreateKeyForm, InviteForm } from "./secret-forms";

export const metadata: Metadata = { title: "Team", robots: { index: false } };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const smallBtn = "rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-risk-high hover:text-risk-high";

async function loadTeam(teamId: string) {
  const db = createAdminClient();
  const [members, invites, keys, jobs, used] = await Promise.all([
    db.from("team_members").select("user_id, role, created_at").eq("team_id", teamId).order("created_at"),
    db.from("team_invites").select("id, email, role, expires_at").eq("team_id", teamId).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
    db.from("api_keys").select("id, name, prefix, created_at, last_used_at, revoked_at").eq("team_id", teamId).order("created_at", { ascending: false }),
    db.from("bulk_jobs").select("id, label, total, created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(5),
    teamUsageThisMonth(teamId),
  ]);
  const ids = (members.data ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
  return {
    members: (members.data ?? []).map((m) => ({ ...m, email: profiles?.find((p) => p.id === m.user_id)?.email ?? "—" })),
    invites: invites.data ?? [],
    keys: keys.data ?? [],
    jobs: jobs.data ?? [],
    used,
  };
}

export default async function TeamPage() {
  const { team, role, canManage, user } = await requireTeam();
  const { members, invites, keys, jobs, used } = await loadTeam(team.id);
  const pct = Math.min(100, Math.round((used / Math.max(1, team.monthly_allowance)) * 100));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand">Business</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{team.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">You&apos;re {role === "owner" ? "the owner" : `a${role === "admin" ? "n admin" : " member"}`}. Lookups you make are billed to the team.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/team/docs" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold hover:border-brand">API docs</Link>
          <Link href="/team/bulk" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">Bulk lookup</Link>
        </div>
      </div>

      {!team.active && (
        <p role="alert" className="mt-4 rounded-xl bg-risk-high-bg px-4 py-3 text-sm font-medium text-risk-high">This business account is inactive. Contact LookX to reactivate it.</p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-sm text-ink-muted">Lookups this month</h2>
          <p className="mt-1 text-2xl font-extrabold">{used} <span className="text-base font-semibold text-ink-muted">/ {team.monthly_allowance}</span></p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-mint-100" role="progressbar" aria-label="Monthly allowance used" aria-valuenow={used} aria-valuemin={0} aria-valuemax={team.monthly_allowance}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-sm text-ink-muted">Team credits</h2>
          <p className="mt-1 text-2xl font-extrabold">{team.credits}</p>
          <p className="text-xs text-ink-muted">Used after the monthly allowance.</p>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-sm text-ink-muted">Seats</h2>
          <p className="mt-1 text-2xl font-extrabold">{members.length} <span className="text-base font-semibold text-ink-muted">/ {team.seats}</span></p>
          <p className="text-xs text-ink-muted">{invites.length} pending invite{invites.length === 1 ? "" : "s"}</p>
        </section>
      </div>

      <section aria-labelledby="members" className="mt-8">
        <h2 id="members" className="text-lg font-bold">Members</h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span><span className="font-medium">{m.email}</span><span className="text-ink-muted"> · {m.role}{m.user_id === user.id && " (you)"}</span></span>
              {canManage && m.role !== "owner" && m.user_id !== user.id && (
                <form action={removeMember}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button className={smallBtn}>Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <div className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h3 className="font-semibold">Invite someone</h3>
            <div className="mt-3"><InviteForm /></div>
            {invites.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink-muted">{i.email} · {i.role} · expires {fmt(i.expires_at)}</span>
                    <form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><button className={smallBtn}>Revoke</button></form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {canManage && (
        <section aria-labelledby="keys" className="mt-8">
          <h2 id="keys" className="text-lg font-bold">API keys</h2>
          <p className="text-sm text-ink-muted">Keys can look up phone numbers and run bulk jobs, billed to the team. Keep them secret and on your server.</p>
          <div className="mt-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
            <CreateKeyForm />
            {keys.length > 0 && (
              <ul className="mt-4 divide-y divide-line text-sm">
                {keys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-medium">{k.name}</span>{" "}
                      <code className="rounded bg-mint-50 px-1.5 text-xs">{k.prefix}…</code>
                      <span className="text-ink-muted">
                        {" "}· created {fmt(k.created_at)} · {k.last_used_at ? `last used ${fmt(k.last_used_at)}` : "never used"}
                      </span>
                    </span>
                    {k.revoked_at ? (
                      <span className="text-xs font-semibold text-ink-muted">Revoked</span>
                    ) : (
                      <form action={revokeApiKey}><input type="hidden" name="id" value={k.id} /><button className={smallBtn}>Revoke</button></form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="jobs" className="mt-8">
        <div className="flex items-center justify-between">
          <h2 id="jobs" className="text-lg font-bold">Recent bulk jobs</h2>
          <Link href="/team/bulk" className="text-sm font-semibold text-brand underline">New bulk lookup</Link>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No bulk jobs yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/team/bulk/${j.id}`} className="flex justify-between px-5 py-3 text-sm hover:bg-mint-50">
                  <span className="font-medium">{j.label ?? "Bulk lookup"}</span>
                  <span className="text-ink-muted">{j.total} numbers · {fmt(j.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
