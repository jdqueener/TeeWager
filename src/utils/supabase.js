import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://zzhilgpznzwxvzgpzwt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aGlsZ3B6bnpud3h2emdwend0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDI5MzEsImV4cCI6MjA5ODQxODkzMX0.2QfdhOb7QI-0fEvVpgYcIF2AhpO0usL2fhfZQFuCnxM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
