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
| `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Buying Starter credits and Pro | Checkout returns "Payments are unavailable" |
| `PAYSTACK_PRO_PLAN_CODE` | Pro auto-renewing monthly | Pro is a one-off 1-month pass |
| `NEXT_PUBLIC_CONTACT_EMAIL` | "Talk to us" (Business) and privacy contact | Those links are hidden |
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

## Payments, credits and history

- **Prices** live in `src/lib/plans.ts` (Starter ₦2,000 = 30 credits that never expire;
  Pro ₦5,000/month = 150 lookups, priority results, full history). The server sets
  every price; the browser only receives a Paystack access code.
- **Checkout**: `POST /api/paystack/initialize` creates a pending transaction and opens
  Paystack's inline popup (falls back to Paystack's hosted page if the popup can't load).
- **Applying payments**: both `POST /api/paystack/webhook` (signature checked with
  HMAC-SHA512) and `GET /api/paystack/verify` re-verify the transaction with Paystack's
  API and call `public.fulfill_payment`, which applies a payment exactly once and
  rejects amount/currency mismatches. Pro renewals (`charge.success` with the Pro plan
  code and a reference we didn't create) extend Pro by a month via
  `public.record_pro_renewal`, also once.
- **Webhook URL** to set in the Paystack dashboard: `https://YOUR_DOMAIN/api/paystack/webhook`.
- **Allowances**: free/monthly allowances are used first, then credits. An expired Pro
  falls back to the free allowance automatically.
- **Priority results** (Pro/Business): deeper AI analysis (higher effort) and higher
  burst limits.
- **History** (`/history`): filter by type or saved, re-run phone lookups any time and
  image lookups while the file still exists (24h). Free/Starter see 30 days plus saved
  results; Pro and Business see everything.

## Admin, legal, SEO and analytics

- **Admin** (`/admin`, admin role only, enforced in pages, server actions and SQL):
  overview with lookups per day, revenue, users, risk mix and items needing attention
  (`public.admin_stats`); `/admin/reports` moderation; `/admin/users` search, plan and
  credit changes, ban/unban, and **flagged users** (heavy lookups in 24h, the same
  number looked up 8+ times in 7 days, repeated rejected reports; `public.flagged_users`);
  `/admin/requests` NDPA/GDPR data requests with a 30-day clock; `/admin/questions`.
- **Rate limiting**: every lookup, report, dispute, OTP, checkout, data request and
  result-polling endpoint is limited per user and/or per hashed IP
  (`public.hit_rate_limit`). The hourly cron prunes old rate-limit and OTP rows.
- **Legal**: `/legal/privacy` (NDPA 2023 + GDPR), `/legal/terms` (with the acceptable
  use policy), `/legal/data-request`. **Replace `[LookX legal entity]` and have both
  reviewed by a lawyer before launch.**
- **SEO**: per-page metadata, `sitemap.xml`, `robots.txt` (results, account and admin
  pages excluded), generated Open Graph image, JSON-LD on the home page.
- **Analytics**: Vercel Analytics (cookieless; result ids and query strings are
  stripped before sending). Enable it in the Vercel project.
- **Security headers**: HSTS, nosniff, frame denial, referrer and permissions policies
  (`next.config.ts`). A nonce-based CSP is still to do once production domains are fixed.

## Business tier (teams, API, bulk)

- **Teams**: an admin sets a user's plan to **Business** (`/admin/users`), which creates a
  team they own. Admins set seats, monthly lookup allowance, team credits and active
  status at `/admin/teams` (e.g. after an invoice is paid). Defaults: 5 seats, 1,000
  lookups a month.
- **Members** join through one-time invite links (7 days, must match the invited email,
  seat-limited; `public.accept_team_invite`). While someone is in a team, their lookups
  are billed to it: monthly allowance first, then team credits (`public.start_lookup`).
- **API keys** (`/team`, owners/admins): `lx_live_...`, shown once, stored as a keyed
  hash, revocable, 60 requests/minute each. Docs for customers at `/team/docs`.
- **Public API** (`/api/v1`): `POST /lookups/phone` (waits for the full result by
  default), `GET /lookups/{id}`, `POST /bulk` (up to 50 numbers), `GET /bulk/{id}`.
  Teams can only read their own lookups.
- **Bulk lookups** (`/team/bulk`): paste or upload a CSV, watch progress, download
  results as CSV (formula-injection safe). Processing runs 5 at a time in the
  background; bulk routes allow up to 300s (needs Vercel Pro or fluid compute).
- Image lookups are not exposed in the API yet.

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
- [x] Phase 6: admin dashboard, rate limiting, legal pages, SEO, analytics
- [x] Phase 7: business tier
