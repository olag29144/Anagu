'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  computePolygonCentroid,
  formatCoordinateString,
  parseCoordinateString,
} from '@/lib/gis-utils';
import type { OpenMapLayerId } from '@/lib/openmap-tiles';
import type { LandListing } from '@/lib/land-store';

const ParcelMiniMapCanvas = dynamic(() => import('./ParcelMiniMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#05080D] flex items-center justify-center text-xs font-mono text-[#94A3B8] animate-pulse">
      Loading OpenMap GIS Boundary…
    </div>
  ),
});

const MINI_LAYERS: Array<{ id: OpenMapLayerId; label: string }> = [
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'hybrid', label: 'Satellite + Labels' },
  { id: 'dark', label: 'Dark GIS' },
];

export function ParcelMiniMap({ parcel }: { parcel: LandListing }) {
  const [layerId, setLayerId] = useState<OpenMapLayerId>('hybrid');

  const center = useMemo(() => {
    if (parcel.lat !== undefined && parcel.lng !== undefined) {
      return { lat: parcel.lat, lng: parcel.lng };
    }
    if (parcel.polygon && parcel.polygon.length > 0) {
      return computePolygonCentroid(parcel.polygon);
    }
    return parseCoordinateString(parcel.coordinates);
  }, [parcel]);

  if (!center) {
    return (
      <div className="h-[260px] w-full rounded-[10px] bg-[#05080D] border border-[rgba(91,133,167,0.20)] flex items-center justify-center text-xs text-[#64748B]">
        No GIS coordinates recorded for this parcel.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-[#94A3B8]">
          {formatCoordinateString(center.lat, center.lng)}
          {parcel.perimeterMeters ? ` · Perimeter ${parcel.perimeterMeters.toLocaleString()} m` : ''}
        </span>
        <div className="inline-flex rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-0.5">
          {MINI_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => setLayerId(layer.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                layerId === layer.id
                  ? 'bg-[#38BDF8]/20 text-[#67E8F9]'
                  : 'text-[#64748B] hover:text-[#E2E8F0]'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[260px] w-full rounded-[10px] overflow-hidden border border-[rgba(91,133,167,0.28)] bg-[#05080D]">
        <ParcelMiniMapCanvas parcel={parcel} center={center} layerId={layerId} />
      </div>
    </div>
  );
}

export default ParcelMiniMap;

