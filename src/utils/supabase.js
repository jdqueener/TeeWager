import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

const SUPABASE_URL      = 'https://zzhilgpznznwxvzgpzwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aGlsZ3B6bnpud3h2emdwend0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDI5MzEsImV4cCI6MjA5ODQxODkzMX0.2QfdhOb7QI-0fEvVpgYcIF2AhpO0usL2fhfZQFuCnxM';

async function getStorage() {
  if (Platform.OS === 'web') return undefined; // Supabase uses localStorage by default on web
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return AsyncStorage;
}

// Synchronous client — storage adapter injected after init for native
const storage = Platform.OS === 'web' ? undefined : (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-async-storage/async-storage').default;
  } catch { return undefined; }
})();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            Platform.OS === 'web' ? undefined : storage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
