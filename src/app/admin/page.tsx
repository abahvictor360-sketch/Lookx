import Link from "next/link";
import { queueCounts } from "@/lib/reports/admin-queue";

export default async function AdminHome() {
  const counts = await queueCounts();
  const cards = [
    { href: "/admin/reports?tab=pending", title: "Pending reports", body: "Reports from new accounts waiting for review.", count: counts.pending },
    { href: "/admin/reports?tab=disputed", title: "Open disputes", body: "Number owners who verified by SMS and disputed a report.", count: counts.disputed },
    { href: "/admin/questions", title: "Image questions", body: "Choose which questions users can ask alongside an image lookup." },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.href} href={c.href} className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-brand">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-bold">{c.title}</h2>
            {c.count !== undefined && (
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${c.count > 0 ? "bg-risk-caution-bg text-risk-caution" : "bg-mint-100 text-brand"}`}>
                {c.count}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">{c.body}</p>
        </Link>
      ))}
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-5">
        <h2 className="font-bold text-ink-muted">Users & usage stats</h2>
        <p className="mt-1 text-sm text-ink-muted">Coming in Phase 6.</p>
      </div>
    </div>
  );
}
