'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type * as LeafletNS from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Eye, ShoppingBag, MapPin, Maximize2, X, Compass } from 'lucide-react';
import {
  NIGERIA_DEFAULT_CENTER,
  computePolygonCentroid,
  formatCoordinateString,
  type LatLngPoint,
} from '@/lib/gis-utils';
import {
  OPEN_MAP_LAYERS,
  createOpenMapTileLayer,
  type OpenMapLayerId,
} from '@/lib/openmap-tiles';
import { formatNaira, type LandListing } from '@/lib/land-store';

interface MappableParcelItem {
  parcel: LandListing;
  position: LatLngPoint;
}

function ExploreParcelsMapCanvasInline({
  mappableParcels,
  layerId,
  activeParcelId,
  fitSignal,
  onSelectParcel,
  onCursorMove,
}: {
  mappableParcels: MappableParcelItem[];
  layerId: OpenMapLayerId;
  activeParcelId: string | null;
  fitSignal: number;
  onSelectParcel: (parcel: LandListing) => void;
  onCursorMove?: (pt: LatLngPoint | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const baseLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const overlayLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectParcel);
  const onCursorMoveRef = useRef(onCursorMove);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelectParcel;
  onCursorMoveRef.current = onCursorMove;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const leafletMod = await import('leaflet');
      const L = (leafletMod.default ?? leafletMod) as typeof LeafletNS;
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [NIGERIA_DEFAULT_CENTER.lat, NIGERIA_DEFAULT_CENTER.lng],
        zoom: 6,
        zoomControl: true,
      });

      L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

      map.on('mousemove', (e: LeafletNS.LeafletMouseEvent) => {
        onCursorMoveRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.on('mouseout', () => {
        onCursorMoveRef.current?.(null);
      });

      const overlayGroup = L.layerGroup().addTo(map);
      mapRef.current = map;
      overlayLayerRef.current = overlayGroup;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      baseLayerRef.current = null;
      overlayLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }
    const nextLayer = createOpenMapTileLayer(L, layerId);
    nextLayer.addTo(map);
    baseLayerRef.current = nextLayer;
  }, [layerId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const overlay = overlayLayerRef.current;
    if (!mapReady || !map || !L || !overlay) return;

    overlay.clearLayers();

    mappableParcels.forEach(({ parcel, position }) => {
      const isSold = parcel.saleStatus === 'sold';
      const isActive = activeParcelId === parcel.id;
      const stroke = isSold ? '#F43F5E' : isActive ? '#67E8F9' : '#38BDF8';

      if (parcel.polygon && parcel.polygon.length >= 3) {
        const poly = L.polygon(
          parcel.polygon.map((p) => [p.lat, p.lng] as [number, number]),
          {
            color: stroke,
            weight: isActive ? 3.5 : 2.5,
            opacity: 0.95,
            fillColor: stroke,
            fillOpacity: isActive ? 0.36 : 0.24,
          },
        );
        poly.on('click', () => onSelectRef.current(parcel));
        poly.addTo(overlay);
      }

      const priceText = isSold ? 'SOLD' : formatNaira(parcel.priceNgn);
      const badgeBg = isSold
        ? 'background:#1E293B;color:#FDA4AF;border:1px solid rgba(244,63,94,0.55);'
        : isActive
          ? 'background:#38BDF8;color:#020305;border:1.5px solid #F4F7FB;'
          : 'background:#020305;color:#67E8F9;border:1.5px solid #38BDF8;';

      const marker = L.marker([position.lat, position.lng], {
        title: parcel.title,
        icon: L.divIcon({
          className: 'anagu-parcel-badge',
          html: `<div style="transform:translate(-50%,-50%);padding:3px 8px;border-radius:7px;font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.65);cursor:pointer;${badgeBg}">${priceText}</div>`,
          iconSize: [0, 0],
        }),
      });
      marker.on('click', () => onSelectRef.current(parcel));
      marker.addTo(overlay);
    });
  }, [mappableParcels, activeParcelId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L || mappableParcels.length === 0) return;

    if (mappableParcels.length === 1) {
      map.setView(
        [mappableParcels[0].position.lat, mappableParcels[0].position.lng],
        15,
      );
      return;
    }

    const bounds = L.latLngBounds(
      mappableParcels.map((m) => [m.position.lat, m.position.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }, [mappableParcels, fitSignal, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}

interface ExploreParcelsMapProps {
  parcels: LandListing[];
  onInspect: (parcel: LandListing) => void;
  onBuy: (parcel: LandListing) => void;
}

export function ExploreParcelsMap({ parcels, onInspect, onBuy }: ExploreParcelsMapProps) {
  const [activeParcel, setActiveParcel] = useState<LandListing | null>(null);
  const [layerId, setLayerId] = useState<OpenMapLayerId>('osm');
  const [fitSignal, setFitSignal] = useState(0);
  const [cursorCoords, setCursorCoords] = useState<LatLngPoint | null>(null);

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#94A3B8]">
          Showing <span className="font-mono text-[#F4F7FB]">{mappableParcels.length}</span>{' '}
          georeferenced parcels on OpenStreetMap GIS. Click any parcel pin or boundary polygon to
          inspect or buy.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFitSignal((s) => s + 1)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-xs text-[#94A3B8] hover:text-[#F4F7FB] hover:border-[#38BDF8]/50 inline-flex items-center gap-1.5 transition-colors"
          >
            <Compass className="h-3.5 w-3.5 text-[#38BDF8]" />
            <span>Fit All</span>
          </button>

          <div className="inline-flex flex-wrap rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-0.5">
            {OPEN_MAP_LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setLayerId(layer.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
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
      </div>

      <div className="relative h-[540px] w-full rounded-[12px] overflow-hidden border border-[rgba(91,133,167,0.28)] bg-[#05080D]">
        <ExploreParcelsMapCanvasInline
          mappableParcels={mappableParcels}
          layerId={layerId}
          activeParcelId={activeParcel?.id ?? null}
          fitSignal={fitSignal}
          onSelectParcel={(parcel) => setActiveParcel(parcel)}
          onCursorMove={setCursorCoords}
        />

        {/* Live GIS Cursor Coordinate Readout */}
        {cursorCoords && (
          <div className="pointer-events-none absolute top-3 right-3 z-20 rounded-md bg-[#020305]/85 backdrop-blur-md border border-[rgba(91,133,167,0.32)] px-2.5 py-1 text-[11px] font-mono text-[#67E8F9]">
            {formatCoordinateString(cursorCoords.lat, cursorCoords.lng)}
          </div>
        )}

        {/* Selected Parcel GIS Popup Card */}
        {activeParcel && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-[330px] z-20 rounded-[12px] bg-[#0A0F16]/95 backdrop-blur-md border border-[rgba(56,189,248,0.42)] p-4 shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-mono text-[#38BDF8] font-semibold">
                  {activeParcel.parcelRef} · {activeParcel.category}
                </p>
                <h3 className="text-sm font-bold text-[#F4F7FB] leading-snug mt-0.5 truncate">
                  {activeParcel.title}
                </h3>
                <p className="text-xs text-[#94A3B8] flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]" />
                  <span className="truncate">{activeParcel.location}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveParcel(null)}
                className="h-7 w-7 rounded-md bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-[#94A3B8] hover:text-[#F4F7FB] flex items-center justify-center shrink-0"
                aria-label="Close parcel preview"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-[rgba(91,133,167,0.18)] pt-2.5">
              <span className="font-mono text-[#94A3B8] inline-flex items-center gap-1">
                <Maximize2 className="h-3.5 w-3.5 text-[#38BDF8]" />
                {activeParcel.areaSqm.toLocaleString()} sqm
              </span>
              <span className="font-mono font-bold text-[#F4F7FB] text-sm">
                {formatNaira(activeParcel.priceNgn)}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => onInspect(activeParcel)}
                className="flex-1 h-9 rounded-lg border border-[rgba(91,133,167,0.3)] bg-[#05080D] text-[#E2E8F0] text-xs font-medium hover:border-[#38BDF8]/60 inline-flex items-center justify-center gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Inspect</span>
              </button>
              <button
                type="button"
                disabled={activeParcel.saleStatus === 'sold'}
                onClick={() => onBuy(activeParcel)}
                className="flex-1 h-9 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>{activeParcel.saleStatus === 'sold' ? 'Sold' : 'Buy Land'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExploreParcelsMap;
