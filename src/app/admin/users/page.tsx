import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LABEL, effectivePlan } from "@/lib/plans";
import type { Profile } from "@/lib/supabase/database.types";
import { adjustCredits, setBanned, setPlan } from "./actions";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const btn = "rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:border-brand";

function UserRow({ p }: { p: Profile }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {p.email}
          {p.role === "admin" && <span className="ml-2 rounded bg-mint-100 px-1.5 text-xs text-brand">admin</span>}
          {p.banned && <span className="ml-2 rounded bg-risk-high-bg px-1.5 text-xs text-risk-high">banned</span>}
        </p>
        <p className="text-xs text-ink-muted">
          {PLAN_LABEL[effectivePlan(p)]} · {p.credits} credits · joined {fmt(p.created_at)}
          {p.plan === "pro" && p.plan_expires_at && ` · Pro until ${fmt(p.plan_expires_at)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={setPlan} className="flex gap-1">
          <input type="hidden" name="user_id" value={p.id} />
          <select name="plan" defaultValue={p.plan} aria-label="Plan" className="rounded-full border border-line bg-white px-2 py-1.5 text-xs">
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro (1 month)</option>
            <option value="business">Business</option>
          </select>
          <button className={btn}>Set plan</button>
        </form>
        <form action={adjustCredits} className="flex gap-1">
          <input type="hidden" name="user_id" value={p.id} />
          <input name="delta" type="number" defaultValue={10} aria-label="Credits to add" className="w-16 rounded-full border border-line px-2 py-1.5 text-xs" />
          <button className={btn}>Add credits</button>
        </form>
        {p.role !== "admin" && (
          <form action={setBanned}>
            <input type="hidden" name="user_id" value={p.id} />
            <input type="hidden" name="banned" value={String(!p.banned)} />
            <button className={`${btn} ${p.banned ? "" : "text-risk-high hover:border-risk-high"}`}>{p.banned ? "Unban" : "Ban"}</button>
          </form>
        )}
      </div>
    </li>
  );
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const db = createAdminClient();

  const [flagged, banned, found] = await Promise.all([
    (await createClient()).rpc("flagged_users"),
    db.from("profiles").select("*").eq("banned", true).order("created_at", { ascending: false }).limit(50),
    q
      ? db.from("profiles").select("*").ilike("email", `%${q.replace(/[%_]/g, "\\$&")}%`).limit(25)
      : db.from("profiles").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <div className="space-y-8">
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search users by email</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by email" className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2.5 focus:border-brand focus:outline-none" />
        <button className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-hover">Search</button>
      </form>

      <section>
        <h2 className="text-lg font-bold">{q ? `Results for “${q}”` : "Newest users"}</h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
          {(found.data ?? []).length === 0 ? <li className="px-5 py-4 text-sm text-ink-muted">No users found.</li> : found.data!.map((p) => <UserRow key={p.id} p={p} />)}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold">Flagged users</h2>
        <p className="text-sm text-ink-muted">
          Heavy lookup volume, the same number looked up many times (possible tracking of a person), or repeated rejected reports.
        </p>
        {(flagged.data ?? []).length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line bg-white/60 p-5 text-sm text-ink-muted">Nobody flagged right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
            {flagged.data!.map((f) => (
              <li key={`${f.user_id}-${f.reason}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <a href={`/admin/users?q=${encodeURIComponent(f.email ?? "")}`} className="font-semibold text-brand underline">{f.email}</a>
                  <span className="text-ink-muted"> · {f.reason}: <strong className="text-ink">{f.metric}</strong></span>
                  {f.banned && <span className="ml-2 rounded bg-risk-high-bg px-1.5 text-xs text-risk-high">banned</span>}
                </span>
                {!f.banned && (
                  <form action={setBanned}>
                    <input type="hidden" name="user_id" value={f.user_id} />
                    <input type="hidden" name="banned" value="true" />
                    <button className={`${btn} text-risk-high hover:border-risk-high`}>Ban</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">Banned users</h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
          {(banned.data ?? []).length === 0 ? <li className="px-5 py-4 text-sm text-ink-muted">No banned users.</li> : banned.data!.map((p) => <UserRow key={p.id} p={p} />)}
        </ul>
      </section>
    </div>
  );
}
