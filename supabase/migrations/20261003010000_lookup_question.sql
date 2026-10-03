-- Optional question a user asked alongside an image lookup
-- (e.g. "Is this photo AI-generated?"). Personal questions about the person in
-- the image are rejected by the API before a lookup is created.
alter table public.lookups
  add column question text check (char_length(question) <= 300);
