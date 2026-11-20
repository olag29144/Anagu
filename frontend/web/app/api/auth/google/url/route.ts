import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function resolveBaseUrl(req: NextRequest): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  const clientOrigin = req.nextUrl.searchParams.get('origin')?.trim();
  if (clientOrigin && /^https?:\/\//i.test(clientOrigin)) {
    return clientOrigin.replace(/\/+$/, '');
  }
  return req.nextUrl.origin.replace(/\/+$/, '');
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const baseUrl = resolveBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      configured: false,
      redirectUri,
      error:
        'Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not configured yet.',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: Buffer.from(JSON.stringify({ redirectUri })).toString('base64url'),
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.json(
    {
      configured: true,
      url,
      redirectUri,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
