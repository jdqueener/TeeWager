-- service_role had select on profiles (see grant_profiles_select_to_service_role.sql)
-- but not update. Native purchases grant Pro through the user's own
-- authenticated session (RLS-governed), so this was never exercised — but
-- the new stripe-webhook function runs as service_role with no user session,
-- and needs to PATCH is_pro on checkout completion. Scoped to update only,
-- same least-privilege pattern as the select grant.

grant update on public.profiles to service_role;
