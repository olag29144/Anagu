'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NIGERIA_DEFAULT_CENTER, type LatLngPoint } from '@/lib/gis-utils';
import {
  createOpenMapTileLayer,
  type OpenMapLayerId,
} from '@/lib/openmap-tiles';
import {
  formatEthFromUsd,
  formatUsd,
  getListingPriceUsd,
  type LandListing,
} from '@/lib/land-store';

export interface MappableParcelItem {
  parcel: LandListing;
  position: LatLngPoint;
}

interface ExploreParcelsMapCanvasProps {
  mappableParcels: MappableParcelItem[];
  layerId: OpenMapLayerId;
  activeParcelId: string | null;
  fitSignal: number;
  onSelectParcel: (parcel: LandListing) => void;
  onCursorMove?: (pt: LatLngPoint | null) => void;
}

export default function ExploreParcelsMapCanvas({
  mappableParcels,
  layerId,
  activeParcelId,
  fitSignal,
  onSelectParcel,
  onCursorMove,
}: ExploreParcelsMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectParcel);
  const onCursorMoveRef = useRef(onCursorMove);

  onSelectRef.current = onSelectParcel;
  onCursorMoveRef.current = onCursorMove;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [NIGERIA_DEFAULT_CENTER.lat, NIGERIA_DEFAULT_CENTER.lng],
      zoom: 6,
      zoomControl: true,
    });

    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      onCursorMoveRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    map.on('mouseout', () => {
      onCursorMoveRef.current?.(null);
    });

    const overlayGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayLayerRef.current = overlayGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      overlayLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }
    const nextLayer = createOpenMapTileLayer(L, layerId);
    nextLayer.addTo(map);
    baseLayerRef.current = nextLayer;
  }, [layerId]);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayLayerRef.current;
    if (!map || !overlay) return;

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

      const parcelUsd = getListingPriceUsd(parcel);
      const priceText = isSold
        ? 'SOLD'
        : `${formatUsd(parcelUsd)} · ${formatEthFromUsd(parcelUsd, 2)}`;
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
  }, [mappableParcels, activeParcelId]);

  // Fit bounds when parcel list changes or user clicks Fit All
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mappableParcels.length === 0) return;

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
  }, [mappableParcels, fitSignal]);

  return <div ref={containerRef} className="h-full w-full" />;
}
