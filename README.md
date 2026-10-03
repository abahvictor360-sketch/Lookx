# LookX

> Look it up before you pay, date, or trust.

LookX checks a phone number or image against public web sources, lookup APIs and its own
community report database, and returns a **risk indicator (not a verdict)**.
Nigeria first (+234, NGN pricing). LookX never identifies people from their face.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage) · Vercel

> Next.js 16 renamed `middleware.ts` to `proxy.ts`. Session refresh lives in `src/proxy.ts`.

## Getting started

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

### Local Supabase (optional)

With Docker running, `npx supabase start` launches a local stack and applies every
migration. `npx supabase status -o env` prints the URL and keys for `.env.local`.

### Which keys are required

| Variable | Needed for | Without it |
| --- | --- | --- |
| Supabase URL / anon / service role | Everything | App runs in a limited demo mode |
| `LOOKX_HASH_SECRET` | Lookups (hashing IPs, queries) | Lookups fail |
| `ANTHROPIC_API_KEY` | AI summaries | A factual template summary is shown |
| `SERPAPI_KEY` / `BRAVE_SEARCH_API_KEY` | Web mentions | "Web search isn't available" |
| `ABSTRACT_PHONE_API_KEY` / Twilio | Live carrier + line type | Nigerian prefix table + numbering plan |

## Database

The schema lives in `supabase/migrations/`. Apply it with the Supabase CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

All tables have RLS enabled. Clients get read access to their own rows only; every
privileged write (lookups, reports, credits, rate limits) goes through server routes
using the service-role key. To make yourself an admin:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## How a phone lookup works

1. `POST /api/lookup/phone` validates the number, applies rate limits (guests: 2/day by
   IP + device cookie), charges the lookup atomically in `public.start_lookup`
   (free 5 phone + 3 image per month, Pro 150, then credits that never expire), stores
   instant number details and returns the lookup id in well under a second.
2. The pipeline runs in `after()`: carrier enrichment, web search (cached 24h per
   number), approved community reports, then the risk score, then the Claude summary.
   Each section is merged into `lookups.raw_results` as soon as it's ready.
3. `/result/[id]` polls `GET /api/lookup/[id]` and fills sections in as they land.
   Shared links strip all searcher data.

Risk scoring lives in `src/lib/risk/phone.ts` (unit-tested, every point has a reason).

## Image questions (admin)

Admins manage the questions users can ask alongside an image at `/admin/questions`
(add, edit, reorder, hide, delete, and allow/disallow typed questions). Every question,
including admin-written ones, passes `src/lib/lookup/question.ts`, which blocks
questions about the person in a photo (identity, relationships, location, contact
details, age, sensitive traits).

## Project layout

```
src/
  app/                  routes (App Router)
    api/lookup/*        lookup endpoints (server-only third-party calls)
    auth/callback       magic-link / OAuth code exchange
  components/           UI components
  lib/
    env.ts              server-only secrets (build fails if imported client-side)
    public-env.ts       NEXT_PUBLIC_* values
    lookup/detect.ts    input detection + phone normalisation (libphonenumber-js)
    supabase/           browser, server, admin (service role) and proxy clients
  proxy.ts              session refresh + optimistic auth redirects
supabase/
  migrations/           SQL schema, RLS, functions, storage buckets
```

## Build phases

- [x] Phase 1: setup, schema with RLS, auth, landing page
- [x] Phase 2: phone lookup pipeline + results page (+ UI redesign, admin image questions)
- [ ] Phase 3: image lookup pipeline, storage, auto-delete job
- [ ] Phase 4: community reports, moderation, disputes with OTP
- [ ] Phase 5: credits, Paystack, history
- [ ] Phase 6: admin dashboard, rate limiting, legal pages, SEO, analytics
- [ ] Phase 7: business tier
