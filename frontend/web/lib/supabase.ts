import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Browser-side Supabase client (singleton).
 * Safe to use in Client Components ('use client').
 * Uses the public anon key — no service role secret is exposed here.
 */
export function createClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
  client = createSupabaseClient(url, anonKey);
  return client;
}
