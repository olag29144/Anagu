import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function renderPopupResultHtml(payload: Record<string, unknown>, fallbackMessage: string) {
  const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Anagu Google Sign-In</title>
    <style>
      body { background: #020305; color: #F4F7FB; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
      .box { max-width: 380px; padding: 24px; border-radius: 12px; background: #0A0F16; border: 1px solid rgba(91,133,167,0.28); }
      p { color: #94A3B8; font-size: 14px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="box">
      <p>${fallbackMessage}</p>
    </div>
    <script>
      (function () {
        var data = ${serialized};
        if (window.opener) {
          window.opener.postMessage(data, '*');
          window.close();
        } else {
          window.location.href = '/dashboard';
        }
      })();
    </script>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}

export async function GET(req: NextRequest) {
  const errorParam = req.nextUrl.searchParams.get('error');
  if (errorParam) {
    return renderPopupResultHtml(
      { type: 'GOOGLE_AUTH_ERROR', error: `Google sign-in cancelled or denied (${errorParam}).` },
      'Google sign-in was cancelled. You can close this window.',
    );
  }

  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!code || !clientId || !clientSecret) {
    return renderPopupResultHtml(
      { type: 'GOOGLE_AUTH_ERROR', error: 'Missing Google authorization code or OAuth credentials.' },
      'Authentication could not be completed. You can close this window.',
    );
  }

  let redirectUri = process.env.APP_URL?.trim()
    ? `${process.env.APP_URL.trim().replace(/\/+$/, '')}/api/auth/google/callback`
    : `${req.nextUrl.origin.replace(/\/+$/, '')}/api/auth/google/callback`;

  if (stateParam) {
    try {
      const parsed = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8')) as {
        redirectUri?: string;
      };
      if (parsed.redirectUri) {
        redirectUri = parsed.redirectUri;
      }
    } catch {
      // Ignore invalid state
    }
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return renderPopupResultHtml(
        { type: 'GOOGLE_AUTH_ERROR', error: 'Failed to exchange Google authorization code.' },
        'Google token exchange failed. You can close this window.',
      );
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return renderPopupResultHtml(
        { type: 'GOOGLE_AUTH_ERROR', error: 'No access token returned by Google.' },
        'Google authentication failed. You can close this window.',
      );
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });

    if (!userRes.ok) {
      return renderPopupResultHtml(
        { type: 'GOOGLE_AUTH_ERROR', error: 'Failed to fetch Google user profile.' },
        'Could not load your Google profile. You can close this window.',
      );
    }

    const userInfo = (await userRes.json()) as {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!userInfo.email) {
      return renderPopupResultHtml(
        { type: 'GOOGLE_AUTH_ERROR', error: 'Google account did not provide an email address.' },
        'No email address returned by Google. You can close this window.',
      );
    }

    return renderPopupResultHtml(
      {
        type: 'GOOGLE_AUTH_SUCCESS',
        profile: {
          googleId: userInfo.id ?? '',
          email: userInfo.email,
          fullName: userInfo.name ?? userInfo.email.split('@')[0],
          avatarUrl: userInfo.picture ?? '',
        },
      },
      'Google sign-in successful! Closing this window…',
    );
  } catch {
    return renderPopupResultHtml(
      { type: 'GOOGLE_AUTH_ERROR', error: 'Unexpected error communicating with Google OAuth.' },
      'Unexpected error during sign-in. You can close this window.',
    );
  }
}
