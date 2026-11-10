import { supabase } from './supabase';

export interface SubmittedApplication {
  id: string;
  status: string;
  createdAt: string;
}

export async function submitApplication(
  payload: Record<string, unknown>,
): Promise<SubmittedApplication> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Unable to retrieve the current session: ${error.message}`);
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to submit an application.');
  }

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  const response = await fetch(`${backendUrl}/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Submission failed (${response.status}): ${body}`);
  }

  const result: unknown = await response.json();
  if (
    typeof result !== 'object' ||
    result === null ||
    !('id' in result) ||
    typeof result.id !== 'string' ||
    result.id.length === 0 ||
    !('status' in result) ||
    typeof result.status !== 'string' ||
    !('createdAt' in result) ||
    typeof result.createdAt !== 'string'
  ) {
    throw new Error('The server returned an invalid application response.');
  }

  return {
    id: result.id,
    status: result.status,
    createdAt: result.createdAt,
  };
}
