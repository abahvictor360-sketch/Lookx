-- =============================================================================
-- Phase 7: Business tier — teams, seats, API keys, bulk lookups
-- =============================================================================

create table public.teams (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 2 and 80),
  owner_id           uuid not null references public.profiles (id) on delete restrict,
  active             boolean not null default true,
  seats              integer not null default 5 check (seats between 1 and 500),
  monthly_allowance  integer not null default 1000 check (monthly_allowance >= 0),
  credits            integer not null default 0 check (credits >= 0),
  created_at         timestamptz not null default now()
);

-- A user belongs to at most one team; while they do, their lookups bill the team.
create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  email       text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  token_hash  text not null unique,
  created_by  uuid references public.profiles (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- API keys: only a SHA-256 hash is stored; the key is shown once at creation.
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  prefix       text not null,
  key_hash     text not null unique,
  created_by   uuid references public.profiles (id) on delete set null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index api_keys_team_idx on public.api_keys (team_id);

create table public.bulk_jobs (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  api_key_id  uuid references public.api_keys (id) on delete set null,
  label       text check (char_length(label) <= 80),
  total       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index bulk_jobs_team_idx on public.bulk_jobs (team_id, created_at desc);

alter table public.lookups
  add column team_id     uuid references public.teams (id) on delete set null,
  add column api_key_id  uuid references public.api_keys (id) on delete set null,
  add column bulk_job_id uuid references public.bulk_jobs (id) on delete set null;
create index lookups_team_month_idx on public.lookups (team_id, billing, created_at);
create index lookups_bulk_idx on public.lookups (bulk_job_id);

alter table public.lookups drop constraint lookups_billing_check;
alter table public.lookups add constraint lookups_billing_check
  check (billing in ('guest', 'free', 'plan', 'credit', 'team'));

-- All business tables are server-only (service role); pages check membership in code.
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.api_keys     enable row level security;
alter table public.bulk_jobs    enable row level security;

-- -----------------------------------------------------------------------------
-- start_lookup v3: team billing.
--   p_team_id set (API key)          -> bill that team
--   user is a team member            -> bill their team
--   otherwise                        -> personal plan, as before
-- Team: monthly_allowance first (billing 'team'), then team credits ('credit').
-- -----------------------------------------------------------------------------
drop function if exists public.start_lookup(uuid, text, text, text, text, jsonb);

create or replace function public.start_lookup(
  p_user_id          uuid,
  p_type             text,
  p_query_hash       text,
  p_normalized_query text,
  p_ip_hash          text,
  p_raw_results      jsonb,
  p_team_id          uuid default null
)
returns table (lookup_id uuid, billing text, error text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_team    uuid := p_team_id;
  v_plan    text;
  v_expires timestamptz;
  v_banned  boolean;
  v_credits integer;
  v_pro     boolean;
  v_allow   integer;
  v_used    integer;
  v_active  boolean;
  v_billing text;
  v_id      uuid;
begin
  if p_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
    select plan, plan_expires_at, banned, credits into v_plan, v_expires, v_banned, v_credits
    from public.profiles where id = p_user_id;
    if not found then
      return query select null::uuid, null::text, 'no_profile'::text; return;
    end if;
    if v_banned then
      return query select null::uuid, null::text, 'banned'::text; return;
    end if;
    if v_team is null then
      select team_id into v_team from public.team_members where user_id = p_user_id;
    end if;
  end if;

  if v_team is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_team::text, 1));
    select active, monthly_allowance, credits into v_active, v_allow, v_credits
    from public.teams where id = v_team;
    if not found or not v_active then
      return query select null::uuid, null::text, 'team_inactive'::text; return;
    end if;
    select count(*) into v_used from public.lookups l
    where l.team_id = v_team and l.billing = 'team' and l.created_at >= date_trunc('month', now());
    if v_used < v_allow then
      v_billing := 'team';
    elsif v_credits > 0 then
      update public.teams set credits = credits - 1 where id = v_team;
      v_billing := 'credit';
    else
      return query select null::uuid, null::text, 'no_credits'::text; return;
    end if;
  elsif p_user_id is not null then
    v_pro := v_plan = 'pro' and v_expires is not null and v_expires > now();
    if v_pro then
      v_allow := 150;
      select count(*) into v_used from public.lookups l
      where l.user_id = p_user_id and l.billing = 'plan' and l.team_id is null
        and l.created_at >= date_trunc('month', now());
    else
      v_allow := case when p_type = 'phone' then 5 else 3 end;
      select count(*) into v_used from public.lookups l
      where l.user_id = p_user_id and l.billing = 'free' and l.type = p_type
        and l.created_at >= date_trunc('month', now());
    end if;
    if v_used < v_allow then
      v_billing := case when v_pro then 'plan' else 'free' end;
    elsif v_credits > 0 then
      update public.profiles set credits = credits - 1 where id = p_user_id;
      v_billing := 'credit';
    else
      return query select null::uuid, null::text, 'no_credits'::text; return;
    end if;
  else
    v_billing := 'guest';
  end if;

  insert into public.lookups
    (user_id, team_id, type, query_hash, normalized_query, ip_hash, billing, status, raw_results)
  values
    (p_user_id, v_team, p_type, p_query_hash, p_normalized_query, p_ip_hash, v_billing, 'processing',
     coalesce(p_raw_results, '{}'::jsonb))
  returning id into v_id;

  return query select v_id, v_billing, null::text;
end;
$$;
revoke execute on function public.start_lookup(uuid, text, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- Accept an invite atomically: valid token, matching email, free seat, not already in a team.
create or replace function public.accept_team_invite(p_token_hash text, p_user_id uuid, p_email text)
returns table (ok boolean, error text, team_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  inv public.team_invites;
  v_seats integer;
  v_members integer;
begin
  select * into inv from public.team_invites where token_hash = p_token_hash for update;
  if not found or inv.accepted_at is not null or inv.expires_at < now() then
    return query select false, 'invalid'::text, null::uuid; return;
  end if;
  if lower(inv.email) <> lower(p_email) then
    return query select false, 'wrong_email'::text, null::uuid; return;
  end if;
  if exists (select 1 from public.team_members where user_id = p_user_id) then
    return query select false, 'already_in_team'::text, null::uuid; return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(inv.team_id::text, 2));
  select seats into v_seats from public.teams where id = inv.team_id;
  select count(*) into v_members from public.team_members where team_id = inv.team_id;
  if v_members >= v_seats then
    return query select false, 'no_seats'::text, null::uuid; return;
  end if;
  insert into public.team_members (team_id, user_id, role) values (inv.team_id, p_user_id, inv.role);
  update public.team_invites set accepted_at = now() where id = inv.id;
  return query select true, null::text, inv.team_id;
end;
$$;
revoke execute on function public.accept_team_invite(text, uuid, text) from public, anon, authenticated;
