-- =============================================================================
-- Admin credit adjustments with an audit trail.
-- =============================================================================

create table public.credit_adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete cascade,
  -- Requested change and the change actually applied (balances never go below 0).
  amount      integer not null check (amount <> 0),
  applied     integer not null,
  balance     integer not null, -- balance after the adjustment
  reason      text not null check (char_length(reason) between 3 and 200),
  admin_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((user_id is null) <> (team_id is null))
);
create index credit_adjustments_user_idx on public.credit_adjustments (user_id, created_at desc);
create index credit_adjustments_team_idx on public.credit_adjustments (team_id, created_at desc);

alter table public.credit_adjustments enable row level security;
-- Users can see adjustments to their own account (shown on the dashboard).
create policy "credit_adjustments: read own" on public.credit_adjustments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Atomically add (or remove) credits for a user OR a team and log it.
-- Called by server code after it has verified the caller is an admin.
create or replace function public.admin_adjust_credits(
  p_admin_id uuid,
  p_user_id  uuid,
  p_team_id  uuid,
  p_amount   integer,
  p_reason   text
)
returns table (ok boolean, applied integer, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_before integer;
  v_after  integer;
begin
  if (p_user_id is null) = (p_team_id is null) or p_amount = 0 then
    return query select false, 0, 0; return;
  end if;

  if p_user_id is not null then
    select credits into v_before from public.profiles where id = p_user_id for update;
    if not found then return query select false, 0, 0; return; end if;
    v_after := greatest(0, v_before + p_amount);
    update public.profiles set credits = v_after where id = p_user_id;
  else
    select credits into v_before from public.teams where id = p_team_id for update;
    if not found then return query select false, 0, 0; return; end if;
    v_after := greatest(0, v_before + p_amount);
    update public.teams set credits = v_after where id = p_team_id;
  end if;

  insert into public.credit_adjustments (user_id, team_id, amount, applied, balance, reason, admin_id)
  values (p_user_id, p_team_id, p_amount, v_after - v_before, v_after, p_reason, p_admin_id);

  return query select true, v_after - v_before, v_after;
end;
$$;
revoke execute on function public.admin_adjust_credits(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
