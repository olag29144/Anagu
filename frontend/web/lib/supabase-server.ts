import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for Server Components and Route Handlers.
 * Uses the anon key — respects RLS policies.
 *
 * Calling cookies() opts this route into dynamic rendering.
 */
export function createServerSupabaseClient() {
  void cookies(); // opt into dynamic rendering
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
  return createSupabaseClient(url, anonKey);
}

/**
 * Service-role Supabase client for trusted server-only operations.
 * NEVER import this in any file bundled for the browser.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-service-key';
  return createSupabaseClient(url, serviceKey);
}
