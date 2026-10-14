import { supabase } from './supabase';

export const TRIAL_ROUNDS = 3;

export async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('is_pro, rounds_completed')
    .eq('id', userId)
    .single();
  return data ?? { is_pro: false, rounds_completed: 0 };
}

// `ignoreDuplicates` makes this an INSERT ... ON CONFLICT DO NOTHING — it only
// ever writes on the very first call for a given user (profile creation), and
// is a no-op for every later call (sign-in, token refresh, etc.), so passing
// `referredBy` here is the one place a partner QR code can be safely attached:
// exactly once, at account creation, regardless of signup method (email,
// Apple, Google — see AuthContext.js, none of which can reliably carry custom
// metadata through every provider's auth flow the way this can).
export async function ensureProfile(userId, referredBy = null) {
  await supabase
    .from('profiles')
    .upsert(
      { id: userId, is_pro: false, rounds_completed: 0, ...(referredBy ? { referred_by: referredBy } : {}) },
      { onConflict: 'id', ignoreDuplicates: true }
    );
}

export async function incrementRoundsCompleted(userId) {
  const profile = await fetchProfile(userId);
  const next = (profile.rounds_completed || 0) + 1;
  await supabase
    .from('profiles')
    .update({ rounds_completed: next })
    .eq('id', userId);
  return next;
}

export async function grantPro(userId, plan = null) {
  await supabase.from('profiles').update({ is_pro: true, ...(plan ? { plan } : {}) }).eq('id', userId);
}

export function trialRoundsLeft(profile) {
  return Math.max(0, TRIAL_ROUNDS - (profile?.rounds_completed || 0));
}

export function isTrialExpired(profile) {
  return !(profile?.is_pro) && (profile?.rounds_completed || 0) >= TRIAL_ROUNDS;
}
