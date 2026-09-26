-- The partners table (portal passwords, bank routing/account numbers) had no
-- RLS at all: the public anon key could read and write every row directly,
-- and any authenticated app user's own auth token could read every row too
-- (not just their own). All privileged reads/writes now go through Edge
-- Functions (partner-signup, partner-login, partner-reset, admin-api) using
-- the service role key, so anon/authenticated no longer need direct access —
-- except the portal's "Sign in with Google" flow, which looks up a partner
-- by the signed-in user's own email using their real auth token; that stays
-- working but is now scoped strictly to their own row.

alter table public.partners enable row level security;

revoke all on public.partners from anon;
revoke all on public.partners from authenticated;

create policy "partner can read own row by email"
  on public.partners for select
  to authenticated
  using (email = (auth.jwt() ->> 'email'));

grant select on public.partners to authenticated;
grant select, insert, update, delete on public.partners to service_role;
