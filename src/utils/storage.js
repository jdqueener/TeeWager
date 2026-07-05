import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  GAME:          'teewager_game_v1',
  DEFS:          'teewager_defs_v1',
  PRO:           'teewager_pro',
  STATS:         'teewager_stats_v1',
  PLAYERS:       'teewager_players_v1',
  ROUNDS_PLAYED: 'teewager_rounds_played',
  TRIAL_USED:    'teewager_trial_used',
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

export async function getRoundsPlayed() {
  const val = await AsyncStorage.getItem(KEYS.ROUNDS_PLAYED);
  return val ? parseInt(val, 10) : 0;
}

export async function incrementRoundsPlayed() {
  const current = await getRoundsPlayed();
  const next = current + 1;
  await AsyncStorage.setItem(KEYS.ROUNDS_PLAYED, String(next));
  return next;
}

export async function isTrialUsed() {
  return (await AsyncStorage.getItem(KEYS.TRIAL_USED)) === '1';
}

export async function setTrialUsed() {
  await AsyncStorage.setItem(KEYS.TRIAL_USED, '1');
}

export async function setProPlan(plan) {
  // plan: 'monthly' | 'annual' | 'lifetime' | 'trial' | null
  if (plan) {
    await AsyncStorage.setItem(KEYS.PRO, plan);
  } else {
    await AsyncStorage.removeItem(KEYS.PRO);
  }
}

export async function getProPlan() {
  return await AsyncStorage.getItem(KEYS.PRO);
}

export async function loadSavedPlayers() {
  const raw = await AsyncStorage.getItem(KEYS.PLAYERS);
  return raw ? JSON.parse(raw) : [];
}

export async function savePlayer(name) {
  const current = await loadSavedPlayers();
  if (current.includes(name)) return;
  await AsyncStorage.setItem(KEYS.PLAYERS, JSON.stringify([...current, name]));
}

export async function deleteSavedPlayer(name) {
  const current = await loadSavedPlayers();
  await AsyncStorage.setItem(KEYS.PLAYERS, JSON.stringify(current.filter(n => n !== name)));
}
