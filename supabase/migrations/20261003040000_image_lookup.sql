-- =============================================================================
-- Phase 3: image lookups
-- =============================================================================

-- Every stored upload, so the cleanup job can delete files after 24 hours.
-- A row is created when an upload URL is issued (image_id/lookup_id null), so
-- files that never become a lookup are cleaned up too.
-- The images row (perceptual hash + report_count) is kept so future re-uploads
-- still match existing reports; only the file itself is deleted.
create table public.image_uploads (
  id            uuid primary key default gen_random_uuid(),
  image_id      uuid references public.images (id) on delete cascade,
  lookup_id     uuid references public.lookups (id) on delete set null,
  storage_path  text not null unique,
  expires_at    timestamptz not null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index image_uploads_expiry_idx on public.image_uploads (expires_at) where deleted_at is null;

alter table public.image_uploads enable row level security;
-- No policies: server (service role) only.

-- -----------------------------------------------------------------------------
-- match_or_create_image: find the stored image whose 256-bit perceptual hash
-- is closest to p_hash (Hamming distance). If it is within p_max_distance the
-- upload is treated as the same picture (resized / re-compressed copies match),
-- otherwise a new images row is created.
--
-- Linear scan over images; fine for early volumes. Swap for an indexed
-- approach (e.g. multi-index hashing) when the table grows large.
-- -----------------------------------------------------------------------------
create or replace function public.match_or_create_image(
  p_hash          text,
  p_max_distance  integer,
  p_storage_path  text,
  p_expires_at    timestamptz
)
returns table (image_id uuid, distance integer, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id   uuid;
  v_dist integer;
begin
  if p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid perceptual hash';
  end if;

  -- Serialise image creation so two near-identical uploads can't both insert.
  perform pg_advisory_xact_lock(hashtextextended('match_or_create_image', 0));

  select i.id, bit_count(('x' || i.perceptual_hash)::bit(256) # ('x' || p_hash)::bit(256))::integer
    into v_id, v_dist
  from public.images i
  where i.perceptual_hash ~ '^[0-9a-f]{64}$'
  order by 2
  limit 1;

  if v_id is not null and v_dist <= p_max_distance then
    update public.images
      set storage_path = p_storage_path, expires_at = p_expires_at
      where id = v_id;
    return query select v_id, v_dist, false;
    return;
  end if;

  insert into public.images (perceptual_hash, storage_path, expires_at)
  values (p_hash, p_storage_path, p_expires_at)
  returning id into v_id;
  return query select v_id, 0, true;
end;
$$;

revoke execute on function public.match_or_create_image(text, integer, text, timestamptz) from public, anon, authenticated;
