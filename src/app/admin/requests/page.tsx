import { createAdminClient } from "@/lib/supabase/admin";
import { updateDataRequest } from "./actions";

const TYPE: Record<string, string> = {
  access: "Copy of data",
  correction: "Correction",
  deletion: "Deletion",
  review_reports: "Review reports",
  objection: "Objection",
  other: "Other",
};

/** Days since each request was made (the legal response clock). */
function withAge<T extends { created_at: string }>(rows: T[]) {
  const now = Date.now();
  return rows.map((r) => ({ ...r, ageDays: Math.floor((now - Date.parse(r.created_at)) / 86_400_000) }));
}

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  const params = await searchParams;
  const showClosed = params.show === "closed";
  let q = createAdminClient().from("data_requests").select("*").order("created_at", { ascending: true }).limit(100);
  q = showClosed ? q.eq("status", "closed") : q.neq("status", "closed");
  const { data } = await q;
  const requests = withAge(data ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Data requests</h2>
          <p className="text-sm text-ink-muted">NDPA 2023 / GDPR requests. Reply by email within 30 days and record what you did.</p>
        </div>
        <a href={showClosed ? "/admin/requests" : "/admin/requests?show=closed"} className="text-sm font-semibold text-brand underline">
          {showClosed ? "Show open" : "Show closed"}
        </a>
      </div>
      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-sm text-ink-muted">No {showClosed ? "closed" : "open"} requests.</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const ageDays = r.ageDays;
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <p className="text-sm">
                  <strong>{TYPE[r.request_type]}</strong> · <a href={`mailto:${r.email}`} className="text-brand underline">{r.email}</a>
                  {r.phone_e164 && <> · {r.phone_e164}</>}
                  <span className={`ml-2 rounded px-1.5 text-xs font-semibold ${ageDays >= 25 && r.status !== "closed" ? "bg-risk-high-bg text-risk-high" : "bg-mint-100 text-brand"}`}>
                    {ageDays} day{ageDays === 1 ? "" : "s"} old
                  </span>
                </p>
                <p className="mt-2 whitespace-pre-line text-ink">{r.details}</p>
                {r.admin_note && <p className="mt-2 text-xs text-ink-muted">Note: {r.admin_note}</p>}
                <form action={updateDataRequest} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" defaultValue={r.admin_note ?? ""} placeholder="What was done (internal)" aria-label="Internal note" className="min-w-0 flex-1 rounded-full border border-line px-4 py-2 text-sm" />
                  <select name="status" defaultValue={r.status} aria-label="Status" className="rounded-full border border-line bg-white px-3 py-2 text-sm">
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover">Save</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
