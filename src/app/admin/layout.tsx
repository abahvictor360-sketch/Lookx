import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
        <nav aria-label="Admin">
          <ul className="flex gap-2 text-sm font-medium">
            <li><Link href="/admin" className="rounded-full px-3 py-1.5 text-ink-muted hover:bg-brand-soft hover:text-brand">Overview</Link></li>
            <li><Link href="/admin/reports" className="rounded-full px-3 py-1.5 text-ink-muted hover:bg-brand-soft hover:text-brand">Reports</Link></li>
            <li><Link href="/admin/questions" className="rounded-full px-3 py-1.5 text-ink-muted hover:bg-brand-soft hover:text-brand">Image questions</Link></li>
          </ul>
        </nav>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
