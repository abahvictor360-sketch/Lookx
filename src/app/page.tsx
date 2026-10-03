import { SearchBox } from "@/components/search-box";
import { isSupabaseConfigured } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";

const USE_CASES = [
  {
    title: "Before you pay",
    body: "Check an online vendor's number for scam and fake-vendor reports before sending money.",
  },
  {
    title: "Before you date",
    body: "See if a profile photo shows up elsewhere under other names, a common sign of a stolen picture.",
  },
  {
    title: "Before you trust",
    body: "Got a strange call, SMS or WhatsApp? See what others have reported about that number.",
  },
];

const STEPS = [
  { n: "1", title: "Enter a number or photo", body: "Any format works: 0801…, +234…, or upload a JPG, PNG or WEBP." },
  { n: "2", title: "We check the sources", body: "Public web mentions, carrier and line data, reverse image search, and LookX community reports." },
  { n: "3", title: "Get a clear risk indicator", body: "Low, Caution or High, with the reasons behind it. An indicator, never a verdict." },
];

export default async function Home() {
  let isSignedIn = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isSignedIn = Boolean(data.user);
  }

  return (
    <>
      <section className="relative isolate overflow-hidden px-4 pb-16 pt-14 sm:pt-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-accent/15 blur-3xl"
        />
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="mb-4 rounded-full border border-navy-600 px-3 py-1 text-xs font-medium text-ink-muted">
            Phone numbers · Photos · Community reports
          </p>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
            Look it up before you pay, date, or trust.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base text-ink-muted sm:text-lg">
            Check a phone number or image against the web and LookX community reports for scams,
            fake vendors, impersonation and stolen photos.
          </p>
          <div className="mt-8 w-full">
            <SearchBox isSignedIn={isSignedIn} />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            2 free phone lookups a day without an account. Image lookups need a free account.
          </p>
        </div>
      </section>

      <section aria-labelledby="use-cases" className="px-4 pb-16">
        <h2 id="use-cases" className="sr-only">What LookX helps with</h2>
        <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {USE_CASES.map((u) => (
            <li key={u.title} className="rounded-2xl border border-navy-700 bg-navy-800 p-5">
              <h3 className="font-semibold text-ink">{u.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{u.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="border-t border-navy-700/70 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 id="how" className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 font-bold text-accent"
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 rounded-2xl border border-navy-700 bg-navy-800 p-5 text-sm text-ink-muted">
            <p>
              <strong className="text-ink">What LookX doesn&apos;t do:</strong> we never identify who a
              person in a photo is or match faces across the web. LookX shows <em>where an image
              appears</em>, not who a face belongs to.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
