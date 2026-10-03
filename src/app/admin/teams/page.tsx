import { createAdminClient } from "@/lib/supabase/admin";
import { updateTeam } from "./actions";

const field = "rounded-full border border-line bg-white px-3 py-1.5 text-sm";

export default async function AdminTeamsPage() {
  const db = createAdminClient();
  const { data: teams } = await db.from("teams").select("*").order("created_at", { ascending: false });
  const ownerIds = (teams ?? []).map((t) => t.owner_id);
  const [{ data: owners }, { data: members }] = await Promise.all([
    ownerIds.length ? db.from("profiles").select("id, email").in("id", ownerIds) : Promise.resolve({ data: [] }),
    db.from("team_members").select("team_id"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Business teams</h2>
        <p className="text-sm text-ink-muted">
          To create a team, set a user&apos;s plan to Business on the Users page. Adjust seats, monthly allowance and
          credits here (for example after an invoice is paid), or deactivate a team.
        </p>
      </div>
      {(teams ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-sm text-ink-muted">No business teams yet.</p>
      ) : (
        <ul className="space-y-4">
          {teams!.map((t) => (
            <li key={t.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <p className="text-sm text-ink-muted">
                Owner {owners?.find((o) => o.id === t.owner_id)?.email} · {(members ?? []).filter((m) => m.team_id === t.id).length} member(s) · {t.credits} credits
                {!t.active && <strong className="ml-2 text-risk-high">inactive</strong>}
              </p>
              <form action={updateTeam} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={t.id} />
                <label className="text-xs text-ink-muted">Name<br /><input name="name" defaultValue={t.name} className={field} /></label>
                <label className="text-xs text-ink-muted">Seats<br /><input name="seats" type="number" defaultValue={t.seats} className={`${field} w-20`} /></label>
                <label className="text-xs text-ink-muted">Monthly lookups<br /><input name="monthly_allowance" type="number" defaultValue={t.monthly_allowance} className={`${field} w-28`} /></label>
                <label className="text-xs text-ink-muted">Add credits<br /><input name="add_credits" type="number" defaultValue={0} className={`${field} w-24`} /></label>
                <label className="text-xs text-ink-muted">Status<br />
                  <select name="active" defaultValue={String(t.active)} className={field}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <button className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover">Save</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
