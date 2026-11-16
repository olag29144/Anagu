'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import type { LatLngPoint } from '@/lib/gis-utils';

interface InteractivePolygonProps {
  paths: LatLngPoint[];
  editable?: boolean;
  draggable?: boolean;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  fillColor?: string;
  fillOpacity?: number;
  zIndex?: number;
  clickable?: boolean;
  onPathChange?: (nextPaths: LatLngPoint[]) => void;
  onClick?: () => void;
}

export function InteractivePolygon({
  paths,
  editable = false,
  draggable = false,
  strokeColor = '#38BDF8',
  strokeOpacity = 0.95,
  strokeWeight = 2.5,
  fillColor = '#38BDF8',
  fillOpacity = 0.22,
  zIndex = 20,
  clickable = true,
  onPathChange,
  onClick,
}: InteractivePolygonProps) {
  const map = useMap();
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const pathListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const onPathChangeRef = useRef(onPathChange);
  const onClickRef = useRef(onClick);
  const suppressSyncRef = useRef(false);

  onPathChangeRef.current = onPathChange;
  onClickRef.current = onClick;

  const clearPathListeners = () => {
    pathListenersRef.current.forEach((l) => google.maps.event.removeListener(l));
    pathListenersRef.current = [];
  };

  const attachPathListeners = (poly: google.maps.Polygon) => {
    clearPathListeners();
    const mvcPath = poly.getPath();
    const emitPath = () => {
      if (suppressSyncRef.current || !onPathChangeRef.current) return;
      const next: LatLngPoint[] = [];
      for (let i = 0; i < mvcPath.getLength(); i++) {
        const pt = mvcPath.getAt(i);
        next.push({ lat: pt.lat(), lng: pt.lng() });
      }
      onPathChangeRef.current(next);
    };

    pathListenersRef.current = [
      google.maps.event.addListener(mvcPath, 'set_at', emitPath),
      google.maps.event.addListener(mvcPath, 'insert_at', emitPath),
      google.maps.event.addListener(mvcPath, 'remove_at', emitPath),
    ];
  };

  useEffect(() => {
    if (!map) return;

    const poly = new google.maps.Polygon({
      map,
      paths,
      editable,
      draggable,
      clickable,
      strokeColor,
      strokeOpacity,
      strokeWeight,
      fillColor,
      fillOpacity,
      zIndex,
    });

    polygonRef.current = poly;
    attachPathListeners(poly);

    const dragListener = google.maps.event.addListener(poly, 'dragend', () => {
      if (suppressSyncRef.current || !onPathChangeRef.current) return;
      const mvcPath = poly.getPath();
      const next: LatLngPoint[] = [];
      for (let i = 0; i < mvcPath.getLength(); i++) {
        const pt = mvcPath.getAt(i);
        next.push({ lat: pt.lat(), lng: pt.lng() });
      }
      onPathChangeRef.current(next);
    });

    const clickListener = google.maps.event.addListener(poly, 'click', () => {
      onClickRef.current?.();
    });

    return () => {
      clearPathListeners();
      google.maps.event.removeListener(dragListener);
      google.maps.event.removeListener(clickListener);
      poly.setMap(null);
      polygonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const poly = polygonRef.current;
    if (!poly) return;
    poly.setOptions({
      editable,
      draggable,
      clickable,
      strokeColor,
      strokeOpacity,
      strokeWeight,
      fillColor,
      fillOpacity,
      zIndex,
    });
  }, [
    editable,
    draggable,
    clickable,
    strokeColor,
    strokeOpacity,
    strokeWeight,
    fillColor,
    fillOpacity,
    zIndex,
  ]);

  useEffect(() => {
    const poly = polygonRef.current;
    if (!poly) return;

    const currentPath = poly.getPath();
    let differs = currentPath.getLength() !== paths.length;
    if (!differs) {
      for (let i = 0; i < paths.length; i++) {
        const existing = currentPath.getAt(i);
        if (
          Math.abs(existing.lat() - paths[i].lat) > 1e-8 ||
          Math.abs(existing.lng() - paths[i].lng) > 1e-8
        ) {
          differs = true;
          break;
        }
      }
    }

    if (!differs) return;

    suppressSyncRef.current = true;
    poly.setPath(paths);
    attachPathListeners(poly);
    suppressSyncRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  return null;
}
