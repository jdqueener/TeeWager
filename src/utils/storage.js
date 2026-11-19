import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { pushPlayers } from './cloudSync';

const KEYS = {
  GAME:          'teewager_game_v1',
  LAST_ROUND:    'teewager_last_round_v1',
  DEFS:          'teewager_defs_v1',
  PRO:           'teewager_pro',
  STATS:         'teewager_stats_v1',
  PLAYERS:       'teewager_players_v1',
  ROUNDS_PLAYED: 'teewager_rounds_played',
  TRIAL_USED:    'teewager_trial_used',
  ONBOARDED:     'teewager_onboarded_v1',
  GUEST_MODE:    'teewager_guest_mode',
  BEAN_PREFS:    'teewager_bean_prefs_v1',
};

export async function saveGame(state) {
  await AsyncStorage.setItem(KEYS.GAME, JSON.stringify(state));
}

export async function loadGame() {
  const raw = await AsyncStorage.getItem(KEYS.GAME);
  return raw ? JSON.parse(raw) : null;
}

export async function clearGame() {
  await AsyncStorage.removeItem(KEYS.GAME);
}

// A read-only snapshot of the most recently finished round, kept around so
// it can be revisited (Breakdown/Settle Up) until the next round actually
// starts, at which point GameContext clears it — only ever one deep, not a
// running history.
export async function saveLastRound(state) {
  await AsyncStorage.setItem(KEYS.LAST_ROUND, JSON.stringify(state));
}

export async function loadLastRound() {
  const raw = await AsyncStorage.getItem(KEYS.LAST_ROUND);
  return raw ? JSON.parse(raw) : null;
}

export async function clearLastRound() {
  await AsyncStorage.removeItem(KEYS.LAST_ROUND);
}

// A saved default for which beans the Setup screen's bean list toggles on —
// lets a returning player skip re-configuring the full list each round.
export async function loadBeanPreferences() {
  const raw = await AsyncStorage.getItem(KEYS.BEAN_PREFS);
  return raw ? JSON.parse(raw) : null;
}

export async function saveBeanPreferences(beanIds) {
  await AsyncStorage.setItem(KEYS.BEAN_PREFS, JSON.stringify(beanIds));
}

export async function loadCustomDefs() {
  const raw = await AsyncStorage.getItem(KEYS.DEFS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveCustomDefs(defs) {
  await AsyncStorage.setItem(KEYS.DEFS, JSON.stringify(defs));
}

export async function isPro() {
  const val = await AsyncStorage.getItem(KEYS.PRO);
  return val === 'true';
}

export async function setPro(val) {
  await AsyncStorage.setItem(KEYS.PRO, val ? 'true' : 'false');
}

export async function loadStats() {
  const raw = await AsyncStorage.getItem(KEYS.STATS);
  return raw ? JSON.parse(raw) : {};
}

export async function saveStats(stats) {
  await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(stats));
}

// On iOS the guest free-round counter is anchored in the Keychain instead of
// AsyncStorage. AsyncStorage is wiped when the app is deleted, letting a
// guest reset their 3 free rounds just by reinstalling; Keychain items
// survive app deletion, closing that loophole. Android/web have no
// equivalent persistent store and keep using AsyncStorage.
export async function getRoundsPlayed() {
  if (Platform.OS === 'ios') {
    const val = await SecureStore.getItemAsync(KEYS.ROUNDS_PLAYED);
    if (val !== null) return parseInt(val, 10);
    // One-time migration for existing installs that already have a count
    // in the old AsyncStorage location.
    const legacy = await AsyncStorage.getItem(KEYS.ROUNDS_PLAYED);
    const seeded = legacy ? parseInt(legacy, 10) : 0;
    await SecureStore.setItemAsync(KEYS.ROUNDS_PLAYED, String(seeded));
    return seeded;
  }
  const val = await AsyncStorage.getItem(KEYS.ROUNDS_PLAYED);
  return val ? parseInt(val, 10) : 0;
}

export async function incrementRoundsPlayed() {
  const current = await getRoundsPlayed();
  const next = current + 1;
  if (Platform.OS === 'ios') {
    await SecureStore.setItemAsync(KEYS.ROUNDS_PLAYED, String(next));
  } else {
    await AsyncStorage.setItem(KEYS.ROUNDS_PLAYED, String(next));
  }
  return next;
}

export async function isTrialUsed() {
  return (await AsyncStorage.getItem(KEYS.TRIAL_USED)) === '1';
}

export async function setTrialUsed() {
  await AsyncStorage.setItem(KEYS.TRIAL_USED, '1');
}

export async function loadSavedPlayers() {
  const raw = await AsyncStorage.getItem(KEYS.PLAYERS);
  return raw ? JSON.parse(raw) : [];
}

async function _getAuthedUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function savePlayer(name) {
  const current = await loadSavedPlayers();
  if (current.includes(name)) return;
  const updated = [...current, name];
  await AsyncStorage.setItem(KEYS.PLAYERS, JSON.stringify(updated));
  const uid = await _getAuthedUserId();
  if (uid) pushPlayers(uid, updated).catch(() => {});
}

export async function hasOnboarded() {
  return (await AsyncStorage.getItem(KEYS.ONBOARDED)) === '1';
}

export async function setOnboarded() {
  await AsyncStorage.setItem(KEYS.ONBOARDED, '1');
}

// Persists "continue as guest" on native, where sessionStorage isn't available
export async function loadGuestFlag() {
  return (await AsyncStorage.getItem(KEYS.GUEST_MODE)) === '1';
}

export async function saveGuestFlag() {
  await AsyncStorage.setItem(KEYS.GUEST_MODE, '1');
}

export async function clearGuestFlag() {
  await AsyncStorage.removeItem(KEYS.GUEST_MODE);
}

export async function deleteSavedPlayer(name) {
  const current = await loadSavedPlayers();
  const updated = current.filter(n => n !== name);
  await AsyncStorage.setItem(KEYS.PLAYERS, JSON.stringify(updated));
  const uid = await _getAuthedUserId();
  if (uid) pushPlayers(uid, updated).catch(() => {});
}
