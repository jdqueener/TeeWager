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

export async function ensureProfile(userId) {
  await supabase
    .from('profiles')
    .upsert({ id: userId, is_pro: false, rounds_completed: 0 }, { onConflict: 'id', ignoreDuplicates: true });
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

export async function grantPro(userId) {
  await supabase.from('profiles').update({ is_pro: true }).eq('id', userId);
}

export function trialRoundsLeft(profile) {
  return Math.max(0, TRIAL_ROUNDS - (profile?.rounds_completed || 0));
}

export function isTrialExpired(profile) {
  return !(profile?.is_pro) && (profile?.rounds_completed || 0) >= TRIAL_ROUNDS;
}
