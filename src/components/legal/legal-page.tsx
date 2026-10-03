import Link from "next/link";
import { publicEnv } from "@/lib/public-env";

/** Shared layout for legal pages: readable measure, table of contents, contact line. */
export function LegalPage({
  title,
  updated,
  sections,
  intro,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: { id: string; title: string; body: React.ReactNode }[];
}) {
  return (
    <div className="flex-1 px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-brand">Legal</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">Last updated {updated}</p>
        <div className="mt-6 space-y-3 text-ink">{intro}</div>

        <nav aria-label="Contents" className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold">Contents</p>
          <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm text-brand sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="hover:underline">{s.title}</a></li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-10 scroll-mt-24">
            <h2 id={`${s.id}-h`} className="text-xl font-bold">{i + 1}. {s.title}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{s.body}</div>
          </section>
        ))}

        <p className="mt-12 rounded-2xl bg-mint-50 p-5 text-sm text-ink-muted">
          Questions? Use our <Link href="/legal/data-request" className="font-semibold text-brand underline">data request form</Link>
          {publicEnv.contactEmail && (
            <> or email <a href={`mailto:${publicEnv.contactEmail}`} className="font-semibold text-brand underline">{publicEnv.contactEmail}</a></>
          )}
          .
        </p>
      </article>
    </div>
  );
}
