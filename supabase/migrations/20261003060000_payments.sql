-- =============================================================================
-- Phase 5: credits, Paystack payments, Pro plan
-- =============================================================================

alter table public.profiles
  -- Pro is active while plan = 'pro' and plan_expires_at > now().
  add column plan_expires_at            timestamptz,
  add column paystack_customer_code     text,
  add column paystack_subscription_code text;

create index profiles_paystack_customer_idx on public.profiles (paystack_customer_code);

alter table public.transactions
  add column product  text not null default 'starter' check (product in ('starter', 'pro')),
  add column currency text not null default 'NGN',
  add column paid_at  timestamptz;

-- -----------------------------------------------------------------------------
-- fulfill_payment: apply a VERIFIED Paystack payment exactly once.
-- Called by both the webhook and the client-side verify route; whichever comes
-- first applies it, the other sees already_applied = true. The caller must have
-- verified the transaction with Paystack's API before calling.
--   starter -> credits += credits_added (credits never expire)
--   pro     -> plan = 'pro', expiry extended by one month from max(now, expiry)
-- -----------------------------------------------------------------------------
create or replace function public.fulfill_payment(
  p_reference     text,
  p_amount        integer,
  p_currency      text,
  p_customer_code text
)
returns table (ok boolean, already_applied boolean, user_id uuid, product text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  t public.transactions;
begin
  select * into t from public.transactions where paystack_reference = p_reference for update;
  if not found then
    return query select false, false, null::uuid, null::text; return;
  end if;
  if t.status = 'success' then
    return query select true, true, t.user_id, t.product; return;
  end if;
  if t.amount <> p_amount or t.currency <> upper(p_currency) then
    update public.transactions set status = 'failed' where id = t.id;
    return query select false, false, t.user_id, t.product; return;
  end if;

  update public.transactions set status = 'success', paid_at = now() where id = t.id;

  if t.product = 'starter' then
    update public.profiles
       set credits = credits + t.credits_added,
           plan = case when plan = 'free' then 'starter' else plan end,
           paystack_customer_code = coalesce(p_customer_code, paystack_customer_code)
     where id = t.user_id;
  else
    update public.profiles
       set plan = 'pro',
           plan_expires_at = greatest(now(), coalesce(plan_expires_at, now())) + interval '1 month',
           paystack_customer_code = coalesce(p_customer_code, paystack_customer_code)
     where id = t.user_id;
  end if;

  return query select true, false, t.user_id, t.product;
end;
$$;

-- Pro auto-renewal: Paystack charges the saved card and sends charge.success
-- with a new reference we didn't create. Record it and extend Pro, once.
create or replace function public.record_pro_renewal(
  p_reference     text,
  p_amount        integer,
  p_currency      text,
  p_customer_code text
)
returns table (ok boolean, already_applied boolean, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid;
begin
  select id into v_user from public.profiles where paystack_customer_code = p_customer_code limit 1;
  if v_user is null then
    return query select false, false, null::uuid; return;
  end if;

  insert into public.transactions (user_id, paystack_reference, amount, credits_added, status, product, currency, paid_at)
  values (v_user, p_reference, p_amount, 0, 'success', 'pro', upper(p_currency), now())
  on conflict (paystack_reference) do nothing;
  if not found then
    return query select true, true, v_user; return;
  end if;

  update public.profiles
     set plan = 'pro',
         plan_expires_at = greatest(now(), coalesce(plan_expires_at, now())) + interval '1 month'
   where id = v_user;
  return query select true, false, v_user;
end;
$$;

revoke execute on function public.fulfill_payment(text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.record_pro_renewal(text, integer, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- start_lookup: Pro allowance only while the Pro period is active.
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
  v_expires timestamptz;
  v_banned  boolean;
  v_credits integer;
  v_pro     boolean;
  v_allow   integer;
  v_used    integer;
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

    v_pro := v_plan = 'pro' and v_expires is not null and v_expires > now();

    if v_pro then
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
    (user_id, type, query_hash, normalized_query, ip_hash, billing, status, raw_results)
  values
    (p_user_id, p_type, p_query_hash, p_normalized_query, p_ip_hash, v_billing, 'processing',
     coalesce(p_raw_results, '{}'::jsonb))
  returning id into v_id;

  return query select v_id, v_billing, null::text;
end;
$$;

revoke execute on function public.start_lookup(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

-- Usage this month, for the dashboard (callable by the signed-in user for themselves).
create or replace function public.my_usage_this_month()
returns table (free_phone integer, free_image integer, plan_used integer, credit_used integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where billing = 'free' and type = 'phone')::integer,
    count(*) filter (where billing = 'free' and type = 'image')::integer,
    count(*) filter (where billing = 'plan')::integer,
    count(*) filter (where billing = 'credit')::integer
  from public.lookups
  where user_id = (select auth.uid()) and created_at >= date_trunc('month', now());
$$;
revoke execute on function public.my_usage_this_month() from public, anon;
grant execute on function public.my_usage_this_month() to authenticated;
