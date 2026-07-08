import { Platform } from 'react-native';

const KEY = 'teewager_ref';

// Call on app load — captures ?ref= from URL and persists it
export function captureReferral() {
  if (Platform.OS !== 'web') return;
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) localStorage.setItem(KEY, ref);
  } catch {}
}

// Returns the stored referral code (or null)
export function getReferral() {
  if (Platform.OS !== 'web') return null;
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

// Clear after it's been attached to a signed-up user
export function clearReferral() {
  if (Platform.OS !== 'web') return;
  try { localStorage.removeItem(KEY); } catch {}
}
