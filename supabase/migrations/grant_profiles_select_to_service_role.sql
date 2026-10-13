-- profiles was missing a grant to service_role entirely (unlike partners,
-- which got one explicitly in lock_down_partners.sql). service_role bypasses
-- RLS, but still needs this base table grant — without it, admin-api's
-- read of profiles (to compute each partner's live referral/conversion
-- counts) failed with 42501 insufficient_privilege even though it uses the
-- service role key. Read-only: doesn't touch anon/authenticated access.

grant select on public.profiles to service_role;
