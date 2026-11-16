'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  computeEdgeMeasurements,
  type LatLngPoint,
} from '@/lib/gis-utils';
import {
  createOpenMapTileLayer,
  type OpenMapLayerId,
} from '@/lib/openmap-tiles';
import type { LandListing } from '@/lib/land-store';

interface ParcelMiniMapCanvasProps {
  parcel: LandListing;
  center: LatLngPoint;
  layerId: OpenMapLayerId;
}

export default function ParcelMiniMapCanvas({
  parcel,
  center,
  layerId,
}: ParcelMiniMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: parcel.polygon && parcel.polygon.length >= 3 ? 18 : 16,
      zoomControl: true,
    });

    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

    const overlayGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayLayerRef.current = overlayGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      overlayLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [parcel, center]);

  return <div ref={containerRef} className="h-full w-full" />;
}
