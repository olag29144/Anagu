'use client';

import React, { createContext, useContext } from 'react';

interface MapsKeyContextValue {
  mapsKey: string;
}

const MapsKeyContext = createContext<MapsKeyContextValue>({ mapsKey: '' });

export function MapsContextProvider({ children }: { children: React.ReactNode }) {
  return (
    <MapsKeyContext.Provider value={{ mapsKey: '' }}>
      {children}
    </MapsKeyContext.Provider>
  );
}

export function useGoogleMapsKey() {
  return useContext(MapsKeyContext);
}

export function GoogleMapsShell({ children }: { children: React.ReactNode }) {
  return <div className="relative w-full h-full">{children}</div>;
}

export function triggerQuotaWarningIfNeeded() {
  // Stub function
}
