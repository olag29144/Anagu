'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useMap,
} from '@vis.gl/react-google-maps';
import { Eye, ShoppingBag, MapPin } from 'lucide-react';
import { GoogleMapsShell } from './MapsContextProvider';
import { InteractivePolygon } from './InteractivePolygon';
import { NIGERIA_DEFAULT_CENTER, computePolygonCentroid } from '@/lib/gis-utils';
import { formatNaira, type LandListing } from '@/lib/land-store';

interface ExploreParcelsMapProps {
  parcels: LandListing[];
  onInspect: (parcel: LandListing) => void;
  onBuy: (parcel: LandListing) => void;
}

function FitBoundsHelper({ parcels }: { parcels: LandListing[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined') return;
    const coords = parcels
      .map((p) => {
        if (p.lat !== undefined && p.lng !== undefined) return { lat: p.lat, lng: p.lng };
        if (p.polygon && p.polygon.length > 0) return computePolygonCentroid(p.polygon);
        return null;
      })
      .filter((pt): pt is { lat: number; lng: number } => Boolean(pt));

    if (coords.length === 0) return;

    if (coords.length === 1) {
      map.panTo(coords[0]);
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    coords.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, 56);
  }, [map, parcels]);

  return null;
}

function ExploreParcelsMapInner({ parcels, onInspect, onBuy }: ExploreParcelsMapProps) {
  const map = useMap();
  const [activeParcel, setActiveParcel] = useState<LandListing | null>(null);
  const [mapTypeId, setMapTypeId] = useState<'hybrid' | 'roadmap' | 'satellite'>('hybrid');

  useEffect(() => {
    if (map) {
      map.setMapTypeId(mapTypeId);
    }
  }, [map, mapTypeId]);

  const mappableParcels = useMemo(() => {
    return parcels
      .map((parcel) => {
        const position =
          parcel.lat !== undefined && parcel.lng !== undefined
            ? { lat: parcel.lat, lng: parcel.lng }
            : parcel.polygon && parcel.polygon.length > 0
              ? computePolygonCentroid(parcel.polygon)
              : null;
        return { parcel, position };
      })
      .filter(
        (item): item is { parcel: LandListing; position: { lat: number; lng: number } } =>
          Boolean(item.position),
      );
  }, [parcels]);

  const activePosition = useMemo(() => {
    if (!activeParcel) return null;
    if (activeParcel.lat !== undefined && activeParcel.lng !== undefined) {
      return { lat: activeParcel.lat, lng: activeParcel.lng };
    }
    if (activeParcel.polygon && activeParcel.polygon.length > 0) {
      return computePolygonCentroid(activeParcel.polygon);
    }
    return null;
  }, [activeParcel]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#94A3B8]">
          Showing <span className="font-mono text-[#F4F7FB]">{mappableParcels.length}</span>{' '}
          georeferenced parcels across Nigeria. Click any parcel pin or boundary polygon to inspect
          or buy.
        </p>

        <div className="inline-flex rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-0.5">
          {(['hybrid', 'satellite', 'roadmap'] as const).map((layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => setMapTypeId(layer)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                mapTypeId === layer
                  ? 'bg-[#38BDF8]/20 text-[#67E8F9]'
                  : 'text-[#64748B] hover:text-[#E2E8F0]'
              }`}
            >
              {layer}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[540px] w-full rounded-[12px] overflow-hidden border border-[rgba(91,133,167,0.28)] bg-[#05080D]">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={NIGERIA_DEFAULT_CENTER}
          defaultZoom={6}
          mapTypeId={mapTypeId}
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          <FitBoundsHelper parcels={parcels} />

          {mappableParcels.map(({ parcel, position }) => {
            const isSold = parcel.saleStatus === 'sold';
            return (
              <React.Fragment key={parcel.id}>
                {parcel.polygon && parcel.polygon.length >= 3 && (
                  <InteractivePolygon
                    paths={parcel.polygon}
                    editable={false}
                    draggable={false}
                    strokeColor={isSold ? '#F43F5E' : '#38BDF8'}
                    fillColor={isSold ? '#F43F5E' : '#38BDF8'}
                    fillOpacity={0.28}
                    strokeWeight={2.5}
                    onClick={() => setActiveParcel(parcel)}
                  />
                )}
                <AdvancedMarker
                  position={position}
                  title={parcel.title}
                  onClick={() => setActiveParcel(parcel)}
                >
                  <div
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold shadow-lg border transition-transform hover:scale-105 cursor-pointer whitespace-nowrap ${
                      isSold
                        ? 'bg-[#1E293B] text-rose-300 border-rose-500/40'
                        : 'bg-[#020305] text-[#67E8F9] border-[#38BDF8]'
                    }`}
                  >
                    {isSold ? 'SOLD' : formatNaira(parcel.priceNgn)}
                  </div>
                </AdvancedMarker>
              </React.Fragment>
            );
          })}

          {activeParcel && activePosition && (
            <InfoWindow
              position={activePosition}
              onCloseClick={() => setActiveParcel(null)}
            >
              <div className="text-slate-900 p-1 w-[250px] space-y-2">
                <div>
                  <p className="text-[10px] font-mono text-sky-700 font-semibold">
                    {activeParcel.parcelRef}
                  </p>
                  <h3 className="text-sm font-bold text-slate-950 leading-snug">
                    {activeParcel.title}
                  </h3>
                  <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0 text-sky-600" />
                    <span className="truncate">{activeParcel.location}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2">
                  <span className="font-mono text-slate-700">
                    {activeParcel.areaSqm.toLocaleString()} sqm
                  </span>
                  <span className="font-mono font-bold text-slate-950">
                    {formatNaira(activeParcel.priceNgn)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onInspect(activeParcel)}
                    className="flex-1 h-8 rounded-md border border-slate-300 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50 inline-flex items-center justify-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Inspect</span>
                  </button>
                  <button
                    type="button"
                    disabled={activeParcel.saleStatus === 'sold'}
                    onClick={() => onBuy(activeParcel)}
                    className="flex-1 h-8 rounded-md bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>{activeParcel.saleStatus === 'sold' ? 'Sold' : 'Buy Land'}</span>
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

export function ExploreParcelsMap(props: ExploreParcelsMapProps) {
  return (
    <GoogleMapsShell fallbackHeightClass="h-[540px]">
      <ExploreParcelsMapInner {...props} />
    </GoogleMapsShell>
  );
}
