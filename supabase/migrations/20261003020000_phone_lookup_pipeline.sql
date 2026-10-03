-- =============================================================================
-- Phase 2: phone lookup pipeline support
-- =============================================================================

alter table public.lookups
  -- Pipeline progress. Sections land in raw_results as they finish.
  add column status text not null default 'processing'
    check (status in ('processing', 'complete', 'failed')),
  -- How this lookup was paid for: guest (daily IP/device limit), free monthly
  -- allowance, plan allowance (Pro), or one paid credit.
  add column billing text not null default 'guest'
    check (billing in ('guest', 'free', 'plan', 'credit')),
  -- HMAC of the requester's IP, kept to deter misuse. Never exposed publicly.
  add column ip_hash text,
  -- "Save to history" flag for signed-in owners.
  add column saved boolean not null default false;

create index lookups_user_billing_month_idx
  on public.lookups (user_id, billing, type, created_at);

-- -----------------------------------------------------------------------------
-- start_lookup: atomically decide how a lookup is paid for and create its row.
--
-- Monthly allowances (calendar month, UTC). Keep in sync with src/lib/plans.ts.
--   free / starter : 5 phone + 3 image lookups, then paid credits
--   pro            : 150 lookups of either type, then paid credits
-- Paid credits never expire; each lookup uses one.
-- Guests (p_user_id null) are limited by the caller via hit_rate_limit().
-- -----------------------------------------------------------------------------
create or replace function public.start_lookup(
  p_user_id          uuid,
  p_type             text,
  p_query_hash       text,
  p_normalized_query text,
  p_ip_hash          text,
  p_raw_results      jsonb
)
returns table (lookup_id uuid, billing text, error text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_plan    text;
  v_banned  boolean;
  v_credits integer;
  v_allow   integer;
  v_used    integer;
  v_billing text;
  v_id      uuid;
begin
  if p_user_id is not null then
    -- Serialise concurrent lookups by the same user so allowances can't be overspent.
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    select plan, banned, credits into v_plan, v_banned, v_credits
    from public.profiles where id = p_user_id;

    if not found then
      return query select null::uuid, null::text, 'no_profile'::text; return;
    end if;
    if v_banned then
      return query select null::uuid, null::text, 'banned'::text; return;
    end if;

    if v_plan = 'pro' then
      v_allow := 150;
      select count(*) into v_used from public.lookups l
      where l.user_id = p_user_id and l.billing = 'plan'
        and l.created_at >= date_trunc('month', now());
    else
      v_allow := case when p_type = 'phone' then 5 else 3 end;
      select count(*) into v_used from public.lookups l
      where l.user_id = p_user_id and l.billing = 'free' and l.type = p_type
        and l.created_at >= date_trunc('month', now());
    end if;

    if v_used < v_allow then
      v_billing := case when v_plan = 'pro' then 'plan' else 'free' end;
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
    (user_id, type, query_hash, normalized_query, ip_hash, billing, status, raw_results)
  values
    (p_user_id, p_type, p_query_hash, p_normalized_query, p_ip_hash, v_billing, 'processing',
     coalesce(p_raw_results, '{}'::jsonb))
  returning id into v_id;

  return query select v_id, v_billing, null::text;
end;
$$;

-- Atomically merge one or more finished sections into raw_results, so parallel
-- pipeline steps never overwrite each other.
create or replace function public.merge_lookup_results(p_id uuid, p_patch jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.lookups set raw_results = raw_results || p_patch where id = p_id;
$$;

revoke execute on function public.start_lookup(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.merge_lookup_results(uuid, jsonb) from public, anon, authenticated;

-- Owners may toggle "saved" on their own lookups (and nothing else).
revoke update on public.lookups from anon, authenticated;
grant update (saved) on public.lookups to authenticated;
create policy "lookups: update own" on public.lookups
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
