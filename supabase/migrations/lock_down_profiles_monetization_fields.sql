-- is_pro/plan were writable directly by the authenticated client (any
-- signed-in user's own session could PATCH their own row with
-- {"is_pro": true}). grantPro() in src/utils/pro.js only ever got called
-- from the app after a real RevenueCat purchase, but nothing stopped the
-- identical REST call being replayed directly with a user's own valid JWT
-- + the public anon key — both already in their possession, and the call
-- shape is sitting in the public JS bundle — to grant themselves Pro for
-- free. RLS governs row ownership, not which columns within an owned row
-- can change, so this needed a column-level privilege restriction.
--
-- is_pro/plan are now only ever written by the service role, from the
-- stripe-webhook, verify-purchase, and revenuecat-webhook edge functions —
-- each of which independently verifies the purchase before writing.
-- referred_by is similarly excluded: it's meant to be set exactly once, by
-- ensureProfile's insert-only upsert, never altered afterward.
--
-- rounds_completed and the cosmetic profile fields remain client-writable
-- since that's existing, intended behavior (inflating your own round count
-- only exhausts your own trial faster — not a monetization bypass).

revoke update on public.profiles from authenticated;
grant update (full_name, scoring_name, display_name, rounds_completed, saved_players, saved_courses)
  on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
