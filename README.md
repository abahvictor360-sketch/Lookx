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
- [ ] Phase 2: phone lookup pipeline + results page
- [ ] Phase 3: image lookup pipeline, storage, auto-delete job
- [ ] Phase 4: community reports, moderation, disputes with OTP
- [ ] Phase 5: credits, Paystack, history
- [ ] Phase 6: admin dashboard, rate limiting, legal pages, SEO, analytics
- [ ] Phase 7: business tier
