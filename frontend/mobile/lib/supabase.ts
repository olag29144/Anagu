import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in AsyncStorage / SecureStore via Expo's native APIs.
    // Supabase v2 uses localStorage by default; on React Native we override
    // this with a custom storage adapter when wiring up the full auth flow.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
