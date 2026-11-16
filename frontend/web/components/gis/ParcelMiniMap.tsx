'use client';

import React, { useMemo } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
} from '@vis.gl/react-google-maps';
import { GoogleMapsShell } from './MapsContextProvider';
import { InteractivePolygon } from './InteractivePolygon';
import { computePolygonCentroid, parseCoordinateString } from '@/lib/gis-utils';
import type { LandListing } from '@/lib/land-store';

function ParcelMiniMapInner({ parcel }: { parcel: LandListing }) {
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
    <div className="h-[260px] w-full rounded-[10px] overflow-hidden border border-[rgba(91,133,167,0.28)] bg-[#05080D]">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={center}
        defaultZoom={parcel.polygon && parcel.polygon.length >= 3 ? 18 : 16}
        mapTypeId="hybrid"
        gestureHandling="greedy"
        streetViewControl={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      >
        {parcel.polygon && parcel.polygon.length >= 3 && (
          <InteractivePolygon
            paths={parcel.polygon}
            editable={false}
            draggable={false}
            strokeColor="#38BDF8"
            fillColor="#38BDF8"
            fillOpacity={0.28}
            strokeWeight={2.5}
          />
        )}
        <AdvancedMarker position={center} title={parcel.title}>
          <Pin background="#38BDF8" borderColor="#020305" glyphColor="#020305" />
        </AdvancedMarker>
      </GoogleMap>
    </div>
  );
}

export function ParcelMiniMap({ parcel }: { parcel: LandListing }) {
  return (
    <GoogleMapsShell fallbackHeightClass="h-[260px]">
      <ParcelMiniMapInner parcel={parcel} />
    </GoogleMapsShell>
  );
}
