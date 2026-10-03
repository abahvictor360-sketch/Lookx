-- =============================================================================
-- Phase 4: community reports, moderation, disputes with phone OTP
-- =============================================================================

-- Moderation audit trail.
alter table public.reports
  add column moderated_by    uuid references public.profiles (id) on delete set null,
  add column moderated_at    timestamptz,
  add column moderation_note text check (char_length(moderation_note) <= 500);

-- A report can have at most one open dispute at a time.
create unique index disputes_one_open_per_report
  on public.disputes (report_id) where status = 'open';

alter table public.disputes
  add column resolved_by uuid references public.profiles (id) on delete set null,
  add column resolved_at timestamptz;

-- -----------------------------------------------------------------------------
-- Disputed reports stay PUBLIC (labelled "disputed") and keep counting toward
-- the risk score until an admin decides. Otherwise anyone who controls a
-- reported number could hide every report about it just by passing OTP.
-- -----------------------------------------------------------------------------
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
        where target_type = 'phone' and target_id = r.target_id and status in ('approved', 'disputed')
      )
      where id = r.target_id;
    else
      update public.images
      set report_count = (
        select count(*) from public.reports
        where target_type = 'image' and target_id = r.target_id and status in ('approved', 'disputed')
      )
      where id = r.target_id;
    end if;
  end loop;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Phone ownership checks for disputes (server only). Codes are sent and
-- checked by Twilio Verify; in development a local code is used instead and
-- only its HMAC is stored.
-- -----------------------------------------------------------------------------
create table public.dispute_verifications (
  id           uuid primary key default gen_random_uuid(),
  phone_e164   text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  report_ids   uuid[] not null check (cardinality(report_ids) between 1 and 20),
  reason       text not null check (char_length(reason) between 10 and 1000),
  provider     text not null check (provider in ('twilio', 'dev')),
  code_hash    text,
  attempts     integer not null default 0,
  expires_at   timestamptz not null,
  verified_at  timestamptz,
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index dispute_verifications_phone_idx on public.dispute_verifications (phone_e164, created_at desc);

alter table public.dispute_verifications enable row level security;
-- No policies: service role only.

-- Atomically count an OTP attempt. Returns the new attempt count, or null if
-- the verification is unknown, already used or expired. Prevents parallel
-- guesses from slipping past the attempt limit.
create or replace function public.bump_dispute_attempt(p_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.dispute_verifications
     set attempts = attempts + 1
   where id = p_id and verified_at is null and expires_at > now()
  returning attempts;
$$;

revoke execute on function public.bump_dispute_attempt(uuid) from public, anon, authenticated;
