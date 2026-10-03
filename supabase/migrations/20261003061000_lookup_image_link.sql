-- Link each image lookup to its matched image (perceptual hash row), so
-- re-runs and reports work from any lookup of the same picture.
alter table public.lookups
  add column image_id uuid references public.images (id) on delete set null;
create index lookups_image_idx on public.lookups (image_id);

-- Backfill from upload records.
update public.lookups l
   set image_id = u.image_id
  from public.image_uploads u
 where u.lookup_id = l.id and u.image_id is not null and l.image_id is null;
