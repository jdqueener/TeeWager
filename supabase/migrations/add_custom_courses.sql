create table if not exists custom_courses (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references auth.users(id) on delete set null,
  name        text not null,
  holes       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- Anyone can read; only authenticated users can insert/update their own
alter table custom_courses enable row level security;

create policy "anyone can read custom courses"
  on custom_courses for select using (true);

create policy "authenticated users can insert"
  on custom_courses for insert with check (auth.uid() = created_by);

create policy "owner can update"
  on custom_courses for update using (auth.uid() = created_by);

-- Explicit Data API grants (required from Oct 30, 2026 — Supabase stops
-- auto-granting new tables; RLS policies above still govern actual access).
grant select on public.custom_courses to anon;
grant select, insert, update, delete on public.custom_courses to authenticated;
grant select, insert, update, delete on public.custom_courses to service_role;
