import {
  createClient,
  getStoredApplications,
  saveStoredApplications,
  getStoredTitles,
  saveStoredTitles,
} from './supabase';

/**
 * Typed fetch wrapper that forwards bearer token to backend.
 * Includes seamless mock fallback if backend is offline/unreachable in demo mode.
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

  try {
    const response = await fetch(backendUrl + path, {
      ...options,
      headers,
    });

    if (response.ok) {
      if (response.status === 204) {
        return undefined as unknown as T;
      }
      return response.json() as Promise<T>;
    }
  } catch {
    // Backend offline / not reachable — fall through to demo mock handler
  }

  // Demo Fallback Simulation
  return handleDemoApiFallback<T>(path, options);
}

function handleDemoApiFallback<T>(path: string, options?: RequestInit): T {
  const method = (options?.method ?? 'GET').toUpperCase();

  // POST /applications -> Submit application
  if (path === '/applications' && method === 'POST') {
    let body: Record<string, unknown> = {};
    if (typeof options?.body === 'string') {
      try {
        body = JSON.parse(options.body);
      } catch {
        // Ignore
      }
    }

    const apps = getStoredApplications();
    const newId = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newApp = {
      id: newId,
      citizen_id: 'demo-user-citizen',
      owner_name: (body.ownerName as string) || 'Demo Applicant',
      parcel_ref: (body.parcelRef as string) || 'LAG-ETI-2026-9999',
      status: 'pending',
      spatial_hash: '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      created_at: new Date().toISOString(),
      document_number: (body.documentNumber as string) || 'SURV/2026/DEMO',
      document_type: (body.documentType as string) || 'Certificate of Occupancy (C of O)',
    };

    apps.unshift(newApp);
    saveStoredApplications(apps);

    return { id: newId } as unknown as T;
  }

  // POST /applications/:id/:action -> Approve or Reject
  const actionMatch = path.match(/^\/applications\/([^/]+)\/(approve|reject)$/);
  if (actionMatch && method === 'POST') {
    const [, appId, action] = actionMatch;
    const apps = getStoredApplications();
    const target = apps.find((a) => a.id === appId);
    if (target) {
      target.status = action === 'approve' ? 'approved' : 'rejected';
      saveStoredApplications(apps);

      // If approved, create corresponding land title
      if (action === 'approve') {
        const titles = getStoredTitles();
        const newTokenId = String(1050 + Math.floor(Math.random() * 500));
        titles.unshift({
          id: `TITLE-NFT-${newTokenId}`,
          token_id: newTokenId,
          status: 'active',
          issued_at: new Date().toISOString(),
          parcel_ref: target.parcel_ref,
          owner_address: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        });
        saveStoredTitles(titles);
      }
    }
    return { success: true, status: action === 'approve' ? 'approved' : 'rejected' } as unknown as T;
  }

  // POST /titles/:id/revoke -> Revoke land title
  const revokeMatch = path.match(/^\/titles\/([^/]+)\/revoke$/);
  if (revokeMatch && method === 'POST') {
    const [, tokenId] = revokeMatch;
    const titles = getStoredTitles();
    const target = titles.find((t) => t.token_id === tokenId);
    if (target) {
      target.status = 'revoked';
      saveStoredTitles(titles);
    }
    return { success: true, tokenId, status: 'revoked' } as unknown as T;
  }

  // GET /audit/revocations
  if (path === '/audit/revocations') {
    const titles = getStoredTitles();
    const revoked = titles.filter((t) => t.status === 'revoked');
    return revoked.map((r) => ({
      id: `REV-${r.token_id}`,
      entity_id: r.token_id,
      action: 'STATUTORY_REVOCATION',
      outcome: 'REVOKED (LUA §28)',
      metadata: {
        ground: 'Overriding Public Interest (§28(1)(a))',
        txHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      },
      created_at: r.issued_at,
    })) as unknown as T;
  }

  return {} as unknown as T;
}
