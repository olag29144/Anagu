'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { signUpOrSignInWithGoogle, type UserAccount } from '@/lib/user-store';

interface GoogleSignUpButtonProps {
  label?: string;
  onSuccess?: (user: UserAccount) => void;
  onError?: (message: string) => void;
}

export function GoogleSignUpButton({
  label = 'Sign up with Google',
  onSuccess,
  onError,
}: GoogleSignUpButtonProps) {
  const [loading, setLoading] = useState(false);
  const [setupInfo, setSetupInfo] = useState<{
    message: string;
    redirectUri?: string;
  } | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1') &&
        origin !== window.location.origin
      ) {
        return;
      }

      const payload = event.data as
        | {
            type?: string;
            error?: string;
            profile?: {
              googleId?: string;
              email?: string;
              fullName?: string;
              avatarUrl?: string;
            };
          }
        | undefined;

      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'GOOGLE_AUTH_ERROR') {
        setLoading(false);
        onError?.(payload.error || 'Google sign-up failed.');
        return;
      }

      if (payload.type === 'GOOGLE_AUTH_SUCCESS' && payload.profile?.email) {
        const result = signUpOrSignInWithGoogle({
          fullName: payload.profile.fullName || payload.profile.email.split('@')[0],
          email: payload.profile.email,
          googleId: payload.profile.googleId,
          avatarUrl: payload.profile.avatarUrl,
        });
        setLoading(false);
        if (result.error || !result.user) {
          onError?.(result.error || 'Unable to sign in with Google account.');
          return;
        }
        onSuccess?.(result.user);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onSuccess, onError]);

  const handleClick = async () => {
    setSetupInfo(null);
    setLoading(true);
    try {
      const origin = encodeURIComponent(window.location.origin);
      const res = await fetch(`/api/auth/google/url?origin=${origin}`);
      const data = (await res.json()) as {
        configured?: boolean;
        url?: string;
        redirectUri?: string;
        error?: string;
      };

      if (!data.configured || !data.url) {
        setLoading(false);
        setSetupInfo({
          message:
            data.error ||
            'Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.',
          redirectUri: data.redirectUri,
        });
        return;
      }

      const popup = window.open(data.url, 'anagu_google_oauth', 'width=520,height=640');
      if (!popup) {
        setLoading(false);
        onError?.('Popup was blocked by your browser. Please allow popups and try again.');
        return;
      }

      const checkClosed = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(checkClosed);
          setLoading(false);
        }
      }, 500);
    } catch {
      setLoading(false);
      onError?.('Unable to initiate Google sign-up right now. Please try again.');
    }
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleClick()}
        className="w-full h-11 px-4 rounded-[8px] bg-white hover:bg-[#F8FAFC] text-[#1F2937] text-sm font-semibold border border-[#E2E8F0] shadow-sm inline-flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#475569]" />
        ) : (
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
        )}
        <span>{loading ? 'Connecting with Google…' : label}</span>
      </button>

      {setupInfo && (
        <div className="rounded-lg bg-[#05080D] border border-amber-500/35 p-3 text-xs text-amber-200 space-y-1.5">
          <p>{setupInfo.message}</p>
          {setupInfo.redirectUri && (
            <p className="font-mono text-[11px] text-[#67E8F9] break-all">
              Authorized Redirect URI: {setupInfo.redirectUri}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
