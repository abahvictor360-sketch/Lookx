import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { isSupabaseConfigured } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";
import { getQuestionConfig } from "@/lib/lookup/questions-config";

type IconName = "cart" | "heart" | "phone" | "image" | "chat" | "user";

const CHECKS: { icon: IconName; title: string; body: string; tags: string[] }[] = [
  { icon: "cart", title: "Online vendors", body: "Check a seller's number before you send money for that phone, shoe or apartment.", tags: ["Jiji", "Instagram", "WhatsApp"] },
  { icon: "heart", title: "Dating profiles", body: "See if a profile photo shows up elsewhere under other names, a common catfish sign.", tags: ["Stolen photos", "Fake profiles"] },
  { icon: "phone", title: "Strange calls & SMS", body: "Find out what others have reported about a number that called or texted you.", tags: ["Spam", "419", "Impersonation"] },
  { icon: "image", title: "Product photos", body: "Spot catalog or stock photos passed off as a seller's own stock.", tags: ["Copied listings", "Stock photos"] },
  { icon: "chat", title: "WhatsApp & Telegram", body: "Verify the number behind an 'agent', 'customer care' or investment offer.", tags: ["Fake agents", "Investment scams"] },
  { icon: "user", title: "Riders & agents", body: "Quick check on a number before you share your address or pay a deposit.", tags: ["Deliveries", "Rentals"] },
];

const STEPS = [
  { n: "1", title: "Enter a number or photo", body: "Any format works: 0801…, +234…, or upload a JPG, PNG or WEBP." },
  { n: "2", title: "We check the sources", body: "Public web mentions, network and line data, reverse image search, and LookX community reports." },
  { n: "3", title: "Get a clear risk indicator", body: "Low, Caution or High, with the reasons behind it. An indicator, never a verdict." },
];

function Icon({ name, className = "h-6 w-6" }: { name: IconName | "shield" | "check"; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    cart: <><path {...common} d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.4-1.1L21 8H6.2" /><circle cx="9.5" cy="20" r="1.2" fill="currentColor" /><circle cx="17" cy="20" r="1.2" fill="currentColor" /></>,
    heart: <path {...common} d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z" />,
    phone: <path {...common} d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />,
    image: <><rect {...common} x="3" y="4" width="18" height="16" rx="2.5" /><circle {...common} cx="9" cy="10" r="1.75" /><path {...common} d="M21 16l-5-5-8 8" /></>,
    chat: <path {...common} d="M4 18.5 5.3 15A7.5 7.5 0 1 1 9 18.8L4 18.5Z" />,
    user: <><circle {...common} cx="12" cy="8.5" r="3.5" /><path {...common} d="M5 20a7 7 0 0 1 14 0" /></>,
    shield: <><path {...common} d="M12 3 5 5.8v5.4c0 4.5 3 8 7 9.8 4-1.8 7-5.3 7-9.8V5.8L12 3Z" /><path {...common} d="m9 12 2 2 4-4" /></>,
    check: <path {...common} d="m5 12.5 4.5 4.5L19 7.5" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/** Decorative floating icons in the hero, as in the brand references. */
function HeroDecor() {
  const items: { name: "shield" | "phone" | "image" | "check"; pos: string; tone: string }[] = [
    { name: "shield", pos: "left-[6%] top-[58%] h-11 w-11", tone: "bg-brand text-white" },
    { name: "phone", pos: "left-[16%] top-[14%] h-9 w-9", tone: "bg-white text-brand" },
    { name: "image", pos: "right-[9%] top-[24%] h-10 w-10", tone: "bg-white text-brand" },
    { name: "check", pos: "right-[18%] top-[8%] h-7 w-7", tone: "bg-brand-bright text-white" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
      {items.map((it, i) => (
        <span
          key={it.name}
          className={`float-slow absolute flex items-center justify-center rounded-xl shadow-lg shadow-brand/10 ${it.pos} ${it.tone}`}
          style={{ animationDelay: `${i * 0.8}s` }}
        >
          <Icon name={it.name} className="h-1/2 w-1/2" />
        </span>
      ))}
    </div>
  );
}

export default async function Home() {
  let isSignedIn = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isSignedIn = Boolean(data.user);
  }
  const questionConfig = await getQuestionConfig();

  return (
    <>
      <section id="search" className="hero-glow relative isolate overflow-hidden px-4 pb-20 pt-14 sm:pt-20">
        <HeroDecor />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-mint-200 bg-white/80 px-3 py-1 text-xs font-semibold text-brand">
            <Icon name="shield" className="h-4 w-4" /> Verify before you trust
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            Look it up before you <span className="text-brand-bright">pay, date, or trust.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base text-ink-muted sm:text-lg">
            Check a phone number or photo against the web and LookX community reports for scams,
            fake vendors, impersonation and stolen photos.
          </p>
          <div className="mt-9 w-full max-w-2xl">
            <SearchBox
              isSignedIn={isSignedIn}
              questions={questionConfig.questions}
              allowCustomQuestions={questionConfig.allowCustom}
            />
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            2 free phone lookups a day, no account needed. Image lookups need a free account.
          </p>
        </div>
      </section>

      <section aria-labelledby="checks" className="relative bg-page px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="mx-auto w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            What people check
          </p>
          <h2 id="checks" className="mt-3 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
            One search, many ways to stay safe
          </h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((c) => (
              <li
                key={c.title}
                className="rounded-2xl border border-line bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-50 text-brand ring-1 ring-mint-200">
                  <Icon name={c.icon} className="h-7 w-7" />
                </span>
                <h3 className="mt-4 font-bold text-ink">{c.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{c.body}</p>
                <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Examples">
                  {c.tags.map((t) => (
                    <li key={t} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-muted">
                      {t}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 id="how" className="text-center text-3xl font-extrabold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col items-center text-center">
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-2 max-w-xs text-sm text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-12 max-w-3xl rounded-2xl border border-line bg-mint-50 p-5 text-center text-sm text-ink-muted">
            <strong className="text-ink">What LookX doesn&apos;t do:</strong> we never identify who a
            person in a photo is or answer questions about their private life. LookX shows{" "}
            <em>where an image appears</em>, not who a face belongs to.
          </p>
        </div>
      </section>

      <section className="hero-glow px-4 py-16 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">About to send money? Check first.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-muted">
          It takes a few seconds and could save you a lot. Seen a scam? Report it and help others stay safe.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="#search" className="rounded-full bg-brand px-8 py-3 font-semibold text-white hover:bg-brand-hover">
            Start a lookup
          </Link>
          <Link href="/report" className="rounded-full border border-brand bg-white px-8 py-3 font-semibold text-brand hover:bg-brand-soft">
            Report a number
          </Link>
        </div>
      </section>
    </>
  );
}
