'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

interface MapsKeyContextValue {
  apiKey: string;
  loading: boolean;
}

const MapsKeyContext = createContext<MapsKeyContextValue>({
  apiKey: '',
  loading: true,
});

let cachedApiKey: string | null = null;
let inflightPromise: Promise<string> | null = null;
let quotaHooksInstalled = false;

export function triggerQuotaWarningIfNeeded(err: unknown): boolean {
  if (typeof window === 'undefined') return false;
  const text =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === 'string'
        ? err
        : JSON.stringify(err ?? '');

  if (
    text.includes('OverQuotaMapError') ||
    text.includes('QuotaExceededError') ||
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return true;
  }
  return false;
}

function installGlobalQuotaHooks() {
  if (typeof window === 'undefined' || quotaHooksInstalled) return;
  quotaHooksInstalled = true;

  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };
}

async function resolveApiKey(): Promise<string> {
  const globalKey =
    typeof globalThis !== 'undefined'
      ? (globalThis as unknown as { GOOGLE_MAPS_API_KEY?: string }).GOOGLE_MAPS_API_KEY || ''
      : '';
  const buildTimeKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || globalKey || '';
  if (buildTimeKey) {
    cachedApiKey = buildTimeKey;
    return buildTimeKey;
  }
  if (cachedApiKey !== null) return cachedApiKey;
  if (!inflightPromise) {
    inflightPromise = fetch('/api/maps-config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data: { apiKey?: string }) => {
        const key = data.apiKey || '';
        if (key) {
          cachedApiKey = key;
        } else {
          inflightPromise = null;
        }
        return key;
      })
      .catch(() => {
        inflightPromise = null;
        return '';
      });
  }
  return inflightPromise;
}

export function MapsContextProvider({ children }: { children: React.ReactNode }) {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [apiKey, setApiKey] = useState<string>(
    () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || cachedApiKey || '',
  );
  const [loading, setLoading] = useState<boolean>(!apiKey);

  useEffect(() => {
    installGlobalQuotaHooks();

    const onQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);

    if (!apiKey) {
      void resolveApiKey().then((key) => {
        setApiKey(key);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
    };
  }, [apiKey]);

  return (
    <MapsKeyContext.Provider value={{ apiKey, loading }}>
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {children}
    </MapsKeyContext.Provider>
  );
}

export function useGoogleMapsApiKey(): MapsKeyContextValue {
  return useContext(MapsKeyContext);
}

export function GoogleMapsShell({
  children,
  fallbackHeightClass = 'h-[460px]',
}: {
  children: React.ReactNode;
  fallbackHeightClass?: string;
}) {
  const { apiKey, loading } = useGoogleMapsApiKey();

  if (loading) {
    return (
      <div
        className={`${fallbackHeightClass} w-full rounded-[10px] bg-[#05080D] border border-[rgba(91,133,167,0.22)] flex items-center justify-center text-xs font-mono text-[#94A3B8] animate-pulse`}
      >
        Initializing GIS Satellite Engine…
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div
        className={`${fallbackHeightClass} w-full rounded-[10px] bg-[#05080D] border border-amber-500/30 p-6 flex flex-col items-center justify-center text-center gap-2`}
      >
        <p className="text-sm font-semibold text-[#F4F7FB]">
          Google Maps GIS Key Pending Configuration
        </p>
        <p className="text-xs text-[#94A3B8] max-w-md">
          Configure <code className="text-[#38BDF8]">GOOGLE_MAPS_API_KEY</code> or{' '}
          <code className="text-[#38BDF8]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in the runtime
          environment to render live satellite maps and spatial parcel tools.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      libraries={['marker', 'geometry', 'places']}
      language="en"
      region="NG"
    >
      {children}
    </APIProvider>
  );
}
