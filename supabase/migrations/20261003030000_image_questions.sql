-- =============================================================================
-- Admin-managed questions users can ask alongside an image lookup.
--
-- Admins choose which questions are offered and whether users may also type
-- their own. Every question (preset or custom) is still checked by the
-- application guard (src/lib/lookup/question.ts): nothing that asks about the
-- PERSON in a photo (identity, relationships, location, ...) can be added or asked.
-- =============================================================================

create table public.image_questions (
  id          uuid primary key default gen_random_uuid(),
  label       text not null check (char_length(label) between 3 and 120),
  -- Optional guidance for the AI on how to answer this question (admin-written).
  guidance    text check (char_length(guidance) <= 500),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index image_questions_active_order_idx on public.image_questions (active, sort_order);

-- Single-row settings table.
create table public.site_settings (
  id                            integer primary key default 1 check (id = 1),
  allow_custom_image_questions  boolean not null default true,
  updated_at                    timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict do nothing;

alter table public.image_questions enable row level security;
alter table public.site_settings  enable row level security;

-- Everyone (including guests) can read the active questions and the settings.
create policy "image_questions: read active" on public.image_questions
  for select to anon, authenticated
  using (active or (select public.is_admin()));

create policy "image_questions: admin insert" on public.image_questions
  for insert to authenticated with check ((select public.is_admin()));
create policy "image_questions: admin update" on public.image_questions
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "image_questions: admin delete" on public.image_questions
  for delete to authenticated using ((select public.is_admin()));

create policy "site_settings: read" on public.site_settings
  for select to anon, authenticated using (true);
create policy "site_settings: admin update" on public.site_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.image_questions (label, guidance, sort_order) values
  ('Does this photo appear under other names?',
   'Compare the names, usernames and profiles on pages where the image appears. Flag if it is used by several unrelated identities.', 10),
  ('Is this photo AI-generated or edited?',
   'Use the authenticity assessment and metadata (software field) to answer.', 20),
  ('Is this a stock or catalog photo?',
   'Check whether matches are stock photo sites, brand catalogs or marketplaces.', 30),
  ('Has this image been reported?',
   'Answer from LookX community reports only.', 40),
  ('Is this product photo copied from another seller?',
   'Look for the same image on other marketplace listings or brand sites.', 50);
