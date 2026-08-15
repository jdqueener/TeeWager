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

// Clear local saved players and courses on sign-out
export async function clearLocalUserData() {
  await Promise.all([
    AsyncStorage.removeItem('teewager_players_v1'),
    AsyncStorage.removeItem('recent_courses'),
  ]);
}
