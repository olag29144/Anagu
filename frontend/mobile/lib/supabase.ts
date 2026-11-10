import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { MMKV } from 'react-native-mmkv';

/**
 * Supabase client for React Native.
 *
 * react-native-url-polyfill is imported first so that the global URL
 * constructor satisfies Supabase's internal requirements on React Native.
 *
 * Uses the public anon key — the service role key must never appear in
 * mobile bundles.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const authStorage = new MMKV({ id: 'anagu-auth' });

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key) => authStorage.getString(key) ?? null,
      setItem: (key, value) => authStorage.set(key, value),
      removeItem: (key) => authStorage.delete(key),
    },
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
