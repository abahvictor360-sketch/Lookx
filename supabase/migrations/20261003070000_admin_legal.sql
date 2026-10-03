-- =============================================================================
-- Phase 6: data requests (NDPA / GDPR), admin stats, housekeeping
-- =============================================================================

-- Data subject requests from anyone (no account needed): access, deletion,
-- correction, report review, objection.
create table public.data_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (char_length(email) between 3 and 254),
  phone_e164   text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  request_type text not null check (request_type in ('access', 'deletion', 'correction', 'review_reports', 'objection', 'other')),
  details      text not null check (char_length(details) between 10 and 2000),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  admin_note   text check (char_length(admin_note) <= 1000),
  handled_by   uuid references public.profiles (id) on delete set null,
  handled_at   timestamptz,
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index data_requests_status_idx on public.data_requests (status, created_at);
alter table public.data_requests enable row level security;
-- No policies: written by the server, read by admins through server code.

create index if not exists lookups_created_idx on public.lookups (created_at);

-- -----------------------------------------------------------------------------
-- admin_stats: one JSON document for the admin dashboard. Admins only.
-- -----------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select jsonb_build_object(
    'lookups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'phone', coalesce(p, 0), 'image', coalesce(i, 0)) order by d), '[]'::jsonb)
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
      left join (
        select date_trunc('day', created_at) as day,
               count(*) filter (where type = 'phone') as p,
               count(*) filter (where type = 'image') as i
        from public.lookups
        where created_at >= date_trunc('day', now()) - interval '13 days'
        group by 1
      ) x on x.day = d
    ),
    'risk_30d', (
      select jsonb_build_object(
        'low', count(*) filter (where risk_level = 'low'),
        'caution', count(*) filter (where risk_level = 'caution'),
        'high', count(*) filter (where risk_level = 'high'))
      from public.lookups where created_at >= now() - interval '30 days'
    ),
    'users_total', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'pro_active', (select count(*) from public.profiles where plan = 'pro' and plan_expires_at > now()),
    'lookups_30d', (select count(*) from public.lookups where created_at >= now() - interval '30 days'),
    'guest_lookups_30d', (select count(*) from public.lookups where created_at >= now() - interval '30 days' and billing = 'guest'),
    'revenue_30d_kobo', (select coalesce(sum(amount), 0) from public.transactions where status = 'success' and paid_at >= now() - interval '30 days'),
    'reports_pending', (select count(*) from public.reports where status = 'pending'),
    'reports_disputed', (select count(*) from public.reports where status = 'disputed'),
    'reports_approved_30d', (select count(*) from public.reports where status = 'approved' and created_at >= now() - interval '30 days'),
    'data_requests_open', (select count(*) from public.data_requests where status <> 'closed'),
    'banned_users', (select count(*) from public.profiles where banned)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- -----------------------------------------------------------------------------
-- flagged_users: accounts worth a look. Heavy lookup volume can indicate
-- misuse (e.g. trying to track a person); repeated rejected reports can
-- indicate false reporting. Admins only.
-- -----------------------------------------------------------------------------
create or replace function public.flagged_users()
returns table (user_id uuid, email text, reason text, metric integer, banned boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return query
    select p.id, p.email, 'Heavy lookups (24h)'::text, count(l.id)::integer, p.banned, p.created_at
    from public.profiles p join public.lookups l on l.user_id = p.id
    where l.created_at >= now() - interval '24 hours' and p.role <> 'admin'
    group by p.id having count(l.id) >= 30
    union all
    select p.id, p.email, 'Same number looked up repeatedly (7d)'::text, max(c)::integer, p.banned, p.created_at
    from public.profiles p
    join (
      select user_id, query_hash, count(*) as c from public.lookups
      where created_at >= now() - interval '7 days' and user_id is not null
      group by 1, 2 having count(*) >= 8
    ) r on r.user_id = p.id
    where p.role <> 'admin'
    group by p.id
    union all
    select p.id, p.email, 'Rejected reports (90d)'::text, count(r.id)::integer, p.banned, p.created_at
    from public.profiles p join public.reports r on r.reporter_id = p.id
    where r.status = 'rejected' and r.moderated_at >= now() - interval '90 days'
    group by p.id having count(r.id) >= 2
    order by 4 desc;
end;
$$;
revoke execute on function public.flagged_users() from public, anon;
grant execute on function public.flagged_users() to authenticated;
