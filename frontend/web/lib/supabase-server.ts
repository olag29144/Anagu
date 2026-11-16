import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function createNoOpServerClient() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (onfulfilled?: (res: { data: null; error: null }) => unknown) => {
      const res = { data: null, error: null };
      return Promise.resolve(onfulfilled ? onfulfilled(res) : res);
    },
  };
  return {
    from: () => builder,
  } as unknown as ReturnType<typeof createSupabaseClient>;
}

/**
 * Server-side Supabase client for Server Components and Route Handlers.
 * Uses the anon key — respects RLS policies.
 *
 * Calling cookies() opts this route into dynamic rendering.
 */
export function createServerSupabaseClient() {
  void cookies(); // opt into dynamic rendering
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes('placeholder.supabase.co')) {
    return createNoOpServerClient();
  }
  return createSupabaseClient(url, anonKey);
}

/**
 * Service-role Supabase client for trusted server-only operations.
 * NEVER import this in any file bundled for the browser.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || url.includes('placeholder.supabase.co')) {
    return createNoOpServerClient();
  }
  return createSupabaseClient(url, serviceKey);
}
