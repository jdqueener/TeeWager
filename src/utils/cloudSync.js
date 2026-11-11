import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Pull saved players and courses from Supabase and write to local storage
export async function pullUserData(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('saved_players, saved_courses')
    .eq('id', userId)
    .single();
  if (!data) return;
  if (data.saved_players?.length) {
    await AsyncStorage.setItem('teewager_players_v1', JSON.stringify(data.saved_players));
  }
  if (data.saved_courses?.length) {
    await AsyncStorage.setItem('recent_courses', JSON.stringify(data.saved_courses));
  }
}

// Push current local players and courses up to Supabase
export async function pushUserData(userId) {
  const [playersRaw, coursesRaw] = await Promise.all([
    AsyncStorage.getItem('teewager_players_v1'),
    AsyncStorage.getItem('recent_courses'),
  ]);
  const saved_players = playersRaw ? JSON.parse(playersRaw) : [];
  const saved_courses = coursesRaw ? JSON.parse(coursesRaw) : [];
  await supabase.from('profiles').update({ saved_players, saved_courses }).eq('id', userId);
}

// Update just players in Supabase
export async function pushPlayers(userId, players) {
  await supabase.from('profiles').update({ saved_players: players }).eq('id', userId);
}

// Update just courses in Supabase
export async function pushCourses(userId, courses) {
  await supabase.from('profiles').update({ saved_courses: courses }).eq('id', userId);
}

// Clear local saved players/courses, the in-progress round, lifetime stats,
// and the local Pro flag on sign-out or account deletion. Without clearing
// the round and stats too, the next person to use this device — a new
// guest, or someone else signing in — would resume the previous account's
// live round (real names, hole-by-hole scores, live bet state) and see
// their stats history, since neither is namespaced per-account, just
// stored flat on-device. The Pro flag is set unconditionally on every
// native purchase (see purchases.js) as a local cache of the signed-in
// account's entitlement — without clearing it here, it leaks "Pro" to
// whoever uses this device next, guest or different account, until their
// own profile fetch (if any) happens to overwrite it.
export async function clearLocalUserData() {
  await Promise.all([
    AsyncStorage.removeItem('teewager_players_v1'),
    AsyncStorage.removeItem('recent_courses'),
    AsyncStorage.removeItem('teewager_game_v1'),
    AsyncStorage.removeItem('teewager_stats_v1'),
    AsyncStorage.removeItem('teewager_pro'),
  ]);
}
