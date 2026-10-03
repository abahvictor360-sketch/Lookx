import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link href="/admin/questions" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-brand">
        <h2 className="font-bold">Image questions</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Choose which questions users can ask alongside an image lookup.
        </p>
      </Link>
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-5">
        <h2 className="font-bold text-ink-muted">Moderation, disputes, usage</h2>
        <p className="mt-1 text-sm text-ink-muted">Coming in a later phase.</p>
      </div>
    </div>
  );
}
