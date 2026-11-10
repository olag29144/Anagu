import { createClient } from './supabase';

/**
 * Typed fetch wrapper that reads the active Supabase session token and
 * forwards it to the NestJS backend as a bearer token.
 *
 * Usage:
 *   const data = await apiCall<Application[]>('/applications');
 *   const result = await apiCall<Application>('/applications', { method: 'POST', body: JSON.stringify(payload) });
 */
export async function apiCall<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (session?.access_token) {
    headers['Authorization'] = 'Bearer ' + session.access_token;
  }

  const response = await fetch(backendUrl + path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error('API ' + response.status + ': ' + text);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}
