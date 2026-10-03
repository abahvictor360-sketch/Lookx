-- =============================================================================
-- LookX initial schema
--
-- Design notes
-- - RLS is enabled on EVERY table. Anything not covered by a policy is denied
--   to the `anon` and `authenticated` roles. All privileged writes (lookups,
--   reports, credits, rate limits) happen in Next.js server routes using the
--   service-role key, which bypasses RLS.
-- - Reporter identities are never exposed publicly: there is no public SELECT
--   on `reports`. Public report data is served by server routes that strip
--   `reporter_id`.
-- - Users can never change their own role, plan or credits (column grants).
-- =============================================================================

create extension if not exists pgcrypto;

-- profiles --------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text check (char_length(full_name) <= 120),
  role        text not null default 'user' check (role in ('user', 'admin')),
  plan        text not null default 'free' check (plan in ('free', 'starter', 'pro', 'business')),
  credits     integer not null default 0 check (credits >= 0),
  -- Account status, used to enforce the acceptable use policy (bans).
  banned      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- phone_numbers ---------------------------------------------------------------
create table public.phone_numbers (
  id               uuid primary key default gen_random_uuid(),
  e164_number      text not null unique check (e164_number ~ '^\+[1-9][0-9]{6,14}$'),
  country          text,
  carrier          text,
  line_type        text,
  report_count     integer not null default 0,
  last_checked_at  timestamptz
);

-- images ----------------------------------------------------------------------
create table public.images (
  id               uuid primary key default gen_random_uuid(),
  perceptual_hash  text not null unique,
  storage_path     text,
  expires_at       timestamptz,
  report_count     integer not null default 0
);

-- lookups ---------------------------------------------------------------------
create table public.lookups (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete set null,
  type              text not null check (type in ('phone', 'image')),
  -- SHA-256 of the normalized query, so logs/analytics never need the raw value.
  query_hash        text not null,
  normalized_query  text,
  risk_level        text check (risk_level in ('low', 'caution', 'high')),
  summary           text,
  raw_results       jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index lookups_user_created_idx on public.lookups (user_id, created_at desc);
create index lookups_query_hash_idx on public.lookups (query_hash);

-- reports ---------------------------------------------------------------------
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references public.profiles (id) on delete cascade,
  target_type    text not null check (target_type in ('phone', 'image')),
  -- Points at phone_numbers.id or images.id depending on target_type.
  target_id      uuid not null,
  category       text not null check (category in ('scam', 'fake_vendor', 'spam', 'harassment', 'impersonation')),
  platform       text not null check (platform in ('whatsapp', 'instagram', 'facebook', 'jiji', 'telegram', 'phone_call', 'sms', 'other')),
  description    text not null check (char_length(description) between 1 and 500),
  evidence_path  text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'disputed')),
  created_at     timestamptz not null default now(),
  -- One report per user per number/image.
  unique (reporter_id, target_type, target_id)
);
create index reports_target_idx on public.reports (target_type, target_id, status);
create index reports_status_idx on public.reports (status, created_at);

-- disputes --------------------------------------------------------------------
create table public.disputes (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.reports (id) on delete cascade,
  claimant_phone  text not null,
  verified        boolean not null default false,
  reason          text not null check (char_length(reason) between 1 and 1000),
  status          text not null default 'open' check (status in ('open', 'upheld', 'rejected')),
  created_at      timestamptz not null default now()
);
create index disputes_status_idx on public.disputes (status, created_at);

-- transactions ----------------------------------------------------------------
create table public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  -- Unique reference makes Paystack webhook processing idempotent.
  paystack_reference  text not null unique,
  amount              integer not null check (amount >= 0), -- in kobo
  credits_added       integer not null default 0,
  status              text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at          timestamptz not null default now()
);
create index transactions_user_idx on public.transactions (user_id, created_at desc);

-- rate_limits -----------------------------------------------------------------
create table public.rate_limits (
  id            uuid primary key default gen_random_uuid(),
  identifier    text not null, -- user id, hashed IP or hashed device fingerprint
  action        text not null, -- e.g. 'lookup_phone', 'lookup_image'
  count         integer not null default 0,
  window_start  timestamptz not null,
  unique (identifier, action, window_start)
);

-- =============================================================================
-- Helper functions
-- =============================================================================

-- Is the current user an admin? SECURITY DEFINER so it can read profiles
-- without recursing through profiles' own RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically increment a fixed-window rate-limit counter and report whether the
-- caller is still within `p_max`. Called from server routes (service role).
create or replace function public.hit_rate_limit(
  p_identifier     text,
  p_action         text,
  p_window_seconds integer,
  p_max            integer
)
returns table (allowed boolean, current_count integer, window_start timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits as rl (identifier, action, count, window_start)
  values (p_identifier, p_action, 1, v_window)
  on conflict (identifier, action, window_start)
  do update set count = rl.count + 1
  returning rl.count into v_count;

  return query select v_count <= p_max, v_count, v_window;
end;
$$;

-- Keep phone_numbers.report_count / images.report_count in sync with the
-- number of APPROVED reports for each target.
create or replace function public.sync_report_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select distinct t.target_type, t.target_id
    from (
      select new.target_type, new.target_id where tg_op in ('INSERT', 'UPDATE')
      union all
      select old.target_type, old.target_id where tg_op in ('UPDATE', 'DELETE')
    ) as t(target_type, target_id)
  loop
    if r.target_type = 'phone' then
      update public.phone_numbers
      set report_count = (
        select count(*) from public.reports
        where target_type = 'phone' and target_id = r.target_id and status = 'approved'
      )
      where id = r.target_id;
    else
      update public.images
      set report_count = (
        select count(*) from public.reports
        where target_type = 'image' and target_id = r.target_id and status = 'approved'
      )
      where id = r.target_id;
    end if;
  end loop;
  return null;
end;
$$;

create trigger reports_sync_count
  after insert or update of status, target_id or delete on public.reports
  for each row execute function public.sync_report_count();

-- Only the service role (server code) may call these.
revoke execute on function public.hit_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_report_count() from public, anon, authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles      enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.images        enable row level security;
alter table public.lookups       enable row level security;
alter table public.reports       enable row level security;
alter table public.disputes      enable row level security;
alter table public.transactions  enable row level security;
alter table public.rate_limits   enable row level security;

-- profiles: users read their own row; admins read all.
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- profiles: users may update their own row, but column grants below restrict
-- them to `full_name` only (no self-promotion to admin, no free credits).
-- Admin changes to role/plan/credits/bans go through server routes.
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- lookups: users read their own history. Inserts happen server-side only.
create policy "lookups: read own" on public.lookups
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "lookups: delete own" on public.lookups
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- reports: reporters see their own reports (status tracking); admins see and
-- moderate everything. Public report data is served by server routes only.
create policy "reports: read own" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "reports: admin update" on public.reports
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- disputes: admin only (claimants interact through server routes).
create policy "disputes: admin read" on public.disputes
  for select to authenticated
  using ((select public.is_admin()));

create policy "disputes: admin update" on public.disputes
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- transactions: users read their own payments; writes via Paystack webhook only.
create policy "transactions: read own" on public.transactions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- phone_numbers / images: admin read; everything else via server routes.
create policy "phone_numbers: admin read" on public.phone_numbers
  for select to authenticated
  using ((select public.is_admin()));

create policy "images: admin read" on public.images
  for select to authenticated
  using ((select public.is_admin()));

-- rate_limits: no policies at all -> service role only.

-- =============================================================================
-- Storage buckets (private). Access is via signed URLs from server routes.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('lookup-images',   'lookup-images',   false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('report-evidence', 'report-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- No storage.objects policies are created: anon/authenticated cannot read or
-- write these buckets directly. Uploads and signed URLs go through the server.
