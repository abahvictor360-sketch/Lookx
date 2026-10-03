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
| `SERPAPI_KEY` (Google Lens) / `TINEYE_API_KEY` | "Where this image appears" | "Reverse image search isn't available" |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID` | SMS codes for disputes | Disputes unavailable in production (dev prints codes to the server log) |
| `CRON_SECRET` | Hourly deletion of uploaded images | Cron route refuses all calls (images are still cleaned after each image lookup) |

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

## How an image lookup works

1. The browser asks `POST /api/lookup/image/upload-url` for a one-time signed upload
   URL and uploads straight to the private `lookup-images` bucket. (Serverless
   functions cap request bodies at ~4.5MB; this keeps 10MB uploads working.)
2. `POST /api/lookup/image { upload_path | url, question_id | question }` checks the
   upload belongs to the user, sniffs the real file type from its bytes, reads
   dimensions and EXIF, computes a 256-bit perceptual hash, charges the lookup
   (3 free image lookups a month, then credits) and returns the id.
   Image links are fetched server-side with SSRF protection (public IPs only,
   checked again at connect time; redirects re-validated; 10MB cap).
3. The pipeline (in `after()`) runs in parallel: match the hash against known images
   (Hamming distance ≤ 16 of 256 bits, so resized / re-compressed / re-encoded copies
   still link to existing reports), reverse image search, and a Claude vision check
   for AI generation, editing, stock/catalog photos and visible watermarks. Then the
   risk score, then a Claude summary that also answers the user's question.

Design decisions to know about:

- **Exact matches only.** Google Lens is queried for pages containing the *same*
  image, never "visually similar" results, which for photos of people amounts to
  face matching.
- **GPS is never shown or stored.** The metadata panel says whether location data is
  present, but not where, so LookX can't be used to locate someone.
- **Crops and mirror images don't match.** Blockhash survives resizing and
  compression (distance 0-2 in tests) but not cropping (~32) or flipping.

### Deleting images after 24 hours

`vercel.json` schedules `GET /api/cron/cleanup-images` hourly (Vercel sends
`Authorization: Bearer $CRON_SECRET`). Each image lookup also cleans up a batch of
expired files. The `images` row (perceptual hash) is kept so future uploads of the
same picture still match reports; only the file is deleted.

Vercel's Hobby plan only runs crons once a day. On Hobby, schedule the job from
Supabase instead (enable the `pg_cron` and `pg_net` extensions first):

```sql
select cron.schedule('lookx-cleanup-images', '0 * * * *', $$
  select net.http_get(
    url := 'https://YOUR_DOMAIN/api/cron/cleanup-images',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
$$);
```

## Community reports, moderation and disputes

- **Reporting** (`/report`, `POST /api/report`): signed-in users report a number, or an
  image they looked up, with a category, platform, description (20-500 chars) and an
  optional screenshot. Screenshots are downscaled in the browser, type-checked on the
  server, stored privately and only visible to moderators. One report per user per
  target; 5 reports a day per user.
- **Moderation**: reports from accounts that aren't trusted yet are held as `pending`.
  An account is trusted once it is 7+ days old, has at least one approved report and
  no rejected reports in the last 90 days (`src/lib/reports/constants.ts`). Admins
  approve or reject at `/admin/reports`, can leave an internal note, and can ban a
  reporter (which rejects their pending reports). Rejected evidence is deleted.
- **Disputes** (`/dispute`): a number's owner picks the public reports to dispute,
  explains why and proves ownership with an SMS code (Twilio Verify; 10-minute
  expiry, 5 attempts counted atomically, 3 codes per number per hour). Disputed
  reports **stay public with a "disputed" label** and still count toward the risk
  score until a moderator decides "Keep report" or "Remove report". Hiding them
  during review would let anyone who controls a reported number hide every report
  about it.
- Reporter identities are never shown publicly; public report data never selects
  `reporter_id`.

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
- [x] Phase 3: image lookup pipeline, storage, auto-delete job
- [x] Phase 4: community reports, moderation, disputes with OTP
- [ ] Phase 5: credits, Paystack, history
- [ ] Phase 6: admin dashboard, rate limiting, legal pages, SEO, analytics
- [ ] Phase 7: business tier
