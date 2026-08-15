alter table profiles
  add column if not exists saved_players jsonb not null default '[]'::jsonb,
  add column if not exists saved_courses  jsonb not null default '[]'::jsonb;
