'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type * as LeafletNS from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  computeEdgeMeasurements,
  computePolygonCentroid,
  formatCoordinateString,
  parseCoordinateString,
  type LatLngPoint,
} from '@/lib/gis-utils';
import {
  createOpenMapTileLayer,
  type OpenMapLayerId,
} from '@/lib/openmap-tiles';
import type { LandListing } from '@/lib/land-store';

const MINI_LAYERS: Array<{ id: OpenMapLayerId; label: string }> = [
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'hybrid', label: 'Satellite + Labels' },
  { id: 'dark', label: 'Dark GIS' },
];

function ParcelMiniMapCanvasInline({
  parcel,
  center,
  layerId,
}: {
  parcel: LandListing;
  center: LatLngPoint;
  layerId: OpenMapLayerId;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const baseLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const overlayLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const leafletMod = await import('leaflet');
      const L = (leafletMod.default ?? leafletMod) as typeof LeafletNS;
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: parcel.polygon && parcel.polygon.length >= 3 ? 18 : 16,
        zoomControl: true,
      });

      L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (parcel.polygon && parcel.polygon.length >= 3) {
      const latLngs = parcel.polygon.map((p) => [p.lat, p.lng] as [number, number]);
      const poly = L.polygon(latLngs, {
        color: '#38BDF8',
        weight: 2.5,
        opacity: 0.95,
        fillColor: '#38BDF8',
        fillOpacity: 0.28,
      });
      poly.addTo(overlay);

      parcel.polygon.forEach((pt, idx) => {
        L.marker([pt.lat, pt.lng], {
          interactive: false,
          icon: L.divIcon({
            className: 'anagu-corner-icon',
            html: `<div style="transform:translate(-50%,-50%);padding:1px 5px;border-radius:4px;background:#38BDF8;color:#020305;border:1.5px solid #020305;font-family:monospace;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.6);">C${idx + 1}</div>`,
            iconSize: [0, 0],
          }),
        }).addTo(overlay);
      });

      const edges = computeEdgeMeasurements(parcel.polygon);
      if (edges.length <= 8) {
        edges.forEach((edge) => {
          L.marker([edge.midpoint.lat, edge.midpoint.lng], {
            interactive: false,
            icon: L.divIcon({
              className: 'anagu-edge-icon',
              html: `<div style="transform:translate(-50%,-50%);padding:1px 5px;border-radius:4px;background:rgba(2,3,5,0.9);color:#67E8F9;border:1px solid rgba(56,189,248,0.5);font-family:monospace;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.6);">${edge.lengthMeters.toFixed(1)} m</div>`,
              iconSize: [0, 0],
            }),
          }).addTo(overlay);
        });
      }

      map.fitBounds(poly.getBounds(), { padding: [36, 36], maxZoom: 18 });
    } else {
      map.setView([center.lat, center.lng], 16);
    }

    L.marker([center.lat, center.lng], {
      title: parcel.title,
      icon: L.divIcon({
        className: 'anagu-pin-icon',
        html: `<div style="transform:translate(-50%,-50%);width:14px;height:14px;border-radius:9999px;background:#38BDF8;border:2.5px solid #020305;box-shadow:0 0 12px rgba(56,189,248,0.85);"></div>`,
        iconSize: [0, 0],
      }),
    }).addTo(overlay);

    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);

    return () => window.clearTimeout(timer);
  }, [parcel, center, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}

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
        <ParcelMiniMapCanvasInline parcel={parcel} center={center} layerId={layerId} />
      </div>
    </div>
  );
}

export default ParcelMiniMap;
