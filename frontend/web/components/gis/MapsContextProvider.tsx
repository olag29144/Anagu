'use client';

import React from 'react';

export function triggerQuotaWarningIfNeeded(_err: unknown): boolean {
  return false;
}

export function MapsContextProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useGoogleMapsApiKey(): { apiKey: string; loading: boolean } {
  return { apiKey: 'openmap', loading: false };
}

export function GoogleMapsShell({
  children,
}: {
  children: React.ReactNode;
  fallbackHeightClass?: string;
}) {
  return <>{children}</>;
}
