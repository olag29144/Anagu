'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  NIGERIA_DEFAULT_CENTER,
  type EdgeMeasurement,
  type LatLngPoint,
} from '@/lib/gis-utils';
import {
  createOpenMapTileLayer,
  type OpenMapLayerId,
} from '@/lib/openmap-tiles';
import type { LandListing } from '@/lib/land-store';

export type MapViewCommand =
  | { type: 'pan'; center: LatLngPoint; zoom?: number; seq: number }
  | { type: 'fitBounds'; points: LatLngPoint[]; seq: number }
  | { type: 'fitBox'; box: [[number, number], [number, number]]; seq: number };

export interface OpenMapControllerApi {
  getCenter: () => LatLngPoint;
  getZoom: () => number;
}

interface OpenMapGisCanvasProps {
  layerId: OpenMapLayerId;
  toolMode: 'draw_polygon' | 'drop_pin' | 'pan';
  isVisible: boolean;
  viewCommand: MapViewCommand | null;
  showRegistryOverlay: boolean;
  existingParcels: LandListing[];
  draftVertices: LatLngPoint[];
  polygonVertices: LatLngPoint[];
  pinPosition: LatLngPoint | null;
  isOverlapping: boolean;
  edgeMeasurements: EdgeMeasurement[];
  onMapReady?: (api: OpenMapControllerApi) => void;
  onCursorMove?: (pt: LatLngPoint | null) => void;
  onZoomChange?: (zoom: number) => void;
  onPinDrop: (pt: LatLngPoint) => void;
  onPinDragEnd: (pt: LatLngPoint) => void;
  onAddDraftVertex: (pt: LatLngPoint) => void;
  onFinishDraft: () => void;
  onCornerDrag: (index: number, pt: LatLngPoint) => void;
  onSelectExistingParcel: (parcel: LandListing) => void;
}

export default function OpenMapGisCanvas({
  layerId,
  toolMode,
  isVisible,
  viewCommand,
  showRegistryOverlay,
  existingParcels,
  draftVertices,
  polygonVertices,
  pinPosition,
  isOverlapping,
  edgeMeasurements,
  onMapReady,
  onCursorMove,
  onZoomChange,
  onPinDrop,
  onPinDragEnd,
  onAddDraftVertex,
  onFinishDraft,
  onCornerDrag,
  onSelectExistingParcel,
}: OpenMapGisCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.LayerGroup | null>(null);
  const registryLayerRef = useRef<L.LayerGroup | null>(null);
  const gisLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLineRef = useRef<L.Polyline | null>(null);
  const hoverLineRef = useRef<L.Polyline | null>(null);

  const toolModeRef = useRef(toolMode);
  const draftVerticesRef = useRef(draftVertices);
  const onPinDropRef = useRef(onPinDrop);
  const onPinDragEndRef = useRef(onPinDragEnd);
  const onAddDraftVertexRef = useRef(onAddDraftVertex);
  const onFinishDraftRef = useRef(onFinishDraft);
  const onCornerDragRef = useRef(onCornerDrag);
  const onSelectExistingRef = useRef(onSelectExistingParcel);
  const onCursorMoveRef = useRef(onCursorMove);
  const onZoomChangeRef = useRef(onZoomChange);
  const onMapReadyRef = useRef(onMapReady);

  toolModeRef.current = toolMode;
  draftVerticesRef.current = draftVertices;
  onPinDropRef.current = onPinDrop;
  onPinDragEndRef.current = onPinDragEnd;
  onAddDraftVertexRef.current = onAddDraftVertex;
  onFinishDraftRef.current = onFinishDraft;
  onCornerDragRef.current = onCornerDrag;
  onSelectExistingRef.current = onSelectExistingParcel;
  onCursorMoveRef.current = onCursorMove;
  onZoomChangeRef.current = onZoomChange;
  onMapReadyRef.current = onMapReady;

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [NIGERIA_DEFAULT_CENTER.lat, NIGERIA_DEFAULT_CENTER.lng],
      zoom: 6,
      zoomControl: true,
    });

    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

    const registryLayer = L.layerGroup().addTo(map);
    const gisLayer = L.layerGroup().addTo(map);

    const draftLine = L.polyline([], {
      color: '#38BDF8',
      weight: 2.5,
      opacity: 0.95,
    }).addTo(map);

    const hoverLine = L.polyline([], {
      color: '#67E8F9',
      weight: 2,
      opacity: 0.75,
      dashArray: '6 6',
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (toolModeRef.current === 'drop_pin') {
        onPinDropRef.current(pt);
        return;
      }
      if (toolModeRef.current === 'draw_polygon') {
        onAddDraftVertexRef.current(pt);
      }
    });

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
      onCursorMoveRef.current?.(pt);

      if (toolModeRef.current === 'draw_polygon' && draftVerticesRef.current.length > 0) {
        const verts = draftVerticesRef.current;
        const last = verts[verts.length - 1];
        const preview: [number, number][] = [
          [last.lat, last.lng],
          [pt.lat, pt.lng],
        ];
        if (verts.length >= 2) {
          preview.push([verts[0].lat, verts[0].lng]);
        }
        hoverLine.setLatLngs(preview);
      } else {
        hoverLine.setLatLngs([]);
      }
    });

    map.on('mouseout', () => {
      onCursorMoveRef.current?.(null);
      hoverLine.setLatLngs([]);
    });

    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (toolModeRef.current !== 'draw_polygon') return;
      L.DomEvent.stop(e);
      if (draftVerticesRef.current.length >= 3) {
        onFinishDraftRef.current();
      }
    });

    map.on('zoomend', () => {
      onZoomChangeRef.current?.(map.getZoom());
    });

    mapRef.current = map;
    registryLayerRef.current = registryLayer;
    gisLayerRef.current = gisLayer;
    draftLineRef.current = draftLine;
    hoverLineRef.current = hoverLine;

    onZoomChangeRef.current?.(map.getZoom());
    onMapReadyRef.current?.({
      getCenter: () => {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng };
      },
      getZoom: () => map.getZoom(),
    });

    return () => {
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      registryLayerRef.current = null;
      gisLayerRef.current = null;
      draftLineRef.current = null;
      hoverLineRef.current = null;
    };
  }, []);

  // Switch tile layer
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

  // Toggle doubleClickZoom & cursor style by toolMode
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map) return;

    if (toolMode === 'draw_polygon') {
      map.doubleClickZoom.disable();
      if (container) container.style.cursor = 'crosshair';
    } else if (toolMode === 'drop_pin') {
      map.doubleClickZoom.enable();
      if (container) container.style.cursor = 'crosshair';
    } else {
      map.doubleClickZoom.enable();
      if (container) container.style.cursor = '';
    }
  }, [toolMode]);

  // Refresh Leaflet layout when step becomes visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) return;

    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (polygonVertices.length >= 3) {
        const bounds = L.latLngBounds(
          polygonVertices.map((p) => [p.lat, p.lng] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 18 });
      } else if (pinPosition) {
        map.panTo([pinPosition.lat, pinPosition.lng]);
      }
    }, 80);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // Execute imperative camera/fit commands from parent
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewCommand) return;

    if (viewCommand.type === 'pan') {
      map.setView(
        [viewCommand.center.lat, viewCommand.center.lng],
        viewCommand.zoom ?? map.getZoom(),
      );
      return;
    }

    if (viewCommand.type === 'fitBounds' && viewCommand.points.length > 0) {
      const bounds = L.latLngBounds(
        viewCommand.points.map((p) => [p.lat, p.lng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 18 });
      return;
    }

    if (viewCommand.type === 'fitBox') {
      map.fitBounds(viewCommand.box, { padding: [40, 40], maxZoom: 17 });
    }
  }, [viewCommand]);

  // Render Existing Registry Parcels Overlay
  useEffect(() => {
    const layer = registryLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (!showRegistryOverlay) return;

    existingParcels.forEach((parcel) => {
      const isSold = parcel.saleStatus === 'sold';
      const color = isSold ? '#F43F5E' : '#10B981';

      if (parcel.polygon && parcel.polygon.length >= 3) {
        const poly = L.polygon(
          parcel.polygon.map((p) => [p.lat, p.lng] as [number, number]),
          {
            color,
            weight: 2,
            opacity: 0.85,
            fillColor: color,
            fillOpacity: 0.16,
            interactive: toolMode === 'pan',
          },
        );
        poly.on('click', () => onSelectExistingRef.current(parcel));
        poly.addTo(layer);
      }

      if (parcel.lat !== undefined && parcel.lng !== undefined) {
        const marker = L.marker([parcel.lat, parcel.lng], {
          title: `${parcel.title} (${parcel.parcelRef})`,
          icon: L.divIcon({
            className: 'anagu-existing-pin',
            html: `<div style="transform:translate(-50%,-50%);width:11px;height:11px;border-radius:9999px;background:${color};border:2px solid #020305;box-shadow:0 2px 6px rgba(0,0,0,0.65);cursor:pointer;"></div>`,
            iconSize: [0, 0],
          }),
        });
        marker.on('click', () => onSelectExistingRef.current(parcel));
        marker.addTo(layer);
      }
    });
  }, [showRegistryOverlay, existingParcels, toolMode]);

  // Render Draft Polygon, Final Polygon, Corner Beacons (C1..C4), Edge Labels, & Center Pin
  useEffect(() => {
    const gisLayer = gisLayerRef.current;
    const draftLine = draftLineRef.current;
    const hoverLine = hoverLineRef.current;
    if (!gisLayer || !draftLine || !hoverLine) return;

    gisLayer.clearLayers();

    // Update draft polyline
    if (toolMode === 'draw_polygon' && draftVertices.length > 0) {
      draftLine.setLatLngs(draftVertices.map((p) => [p.lat, p.lng] as [number, number]));
    } else {
      draftLine.setLatLngs([]);
      hoverLine.setLatLngs([]);
    }

    // Draft vertex markers
    draftVertices.forEach((pt, idx) => {
      const isFirstClosable = idx === 0 && draftVertices.length >= 3;
      const bg = isFirstClosable ? '#34D399' : '#38BDF8';
      const size = isFirstClosable ? '24px' : '20px';

      const marker = L.marker([pt.lat, pt.lng], {
        title: isFirstClosable ? 'Click 1 to close boundary' : `Corner ${idx + 1}`,
        icon: L.divIcon({
          className: 'anagu-draft-vertex',
          html: `<div style="transform:translate(-50%,-50%);width:${size};height:${size};border-radius:9999px;background:${bg};color:#020305;border:2px solid #020305;font-family:monospace;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.7);cursor:${isFirstClosable ? 'pointer' : 'default'};">${idx + 1}</div>`,
          iconSize: [0, 0],
        }),
      });
      if (isFirstClosable) {
        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onFinishDraftRef.current();
        });
      }
      marker.addTo(gisLayer);
    });

    // Finalized parcel polygon
    const activeColor = isOverlapping ? '#F59E0B' : '#38BDF8';
    if (polygonVertices.length >= 3) {
      L.polygon(
        polygonVertices.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: activeColor,
          weight: 3,
          opacity: 0.95,
          fillColor: activeColor,
          fillOpacity: 0.24,
        },
      ).addTo(gisLayer);

      // Draggable Corner Beacon Badges (C1, C2, C3, C4...)
      polygonVertices.forEach((pt, idx) => {
        const cornerMarker = L.marker([pt.lat, pt.lng], {
          draggable: true,
          zIndexOffset: 400,
          title: `Corner C${idx + 1} (${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}) — drag to adjust`,
          icon: L.divIcon({
            className: 'anagu-corner-beacon',
            html: `<div style="transform:translate(-50%,-50%);padding:1px 6px;border-radius:5px;background:${activeColor};color:#020305;border:1.5px solid #020305;font-family:monospace;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.7);cursor:grab;">C${idx + 1}</div>`,
            iconSize: [0, 0],
          }),
        });

        cornerMarker.on('dragend', () => {
          const next = cornerMarker.getLatLng();
          onCornerDragRef.current(idx, { lat: next.lat, lng: next.lng });
        });
        cornerMarker.addTo(gisLayer);
      });

      // Edge dimension labels
      if (polygonVertices.length <= 8) {
        edgeMeasurements.forEach((edge) => {
          L.marker([edge.midpoint.lat, edge.midpoint.lng], {
            interactive: false,
            zIndexOffset: 300,
            icon: L.divIcon({
              className: 'anagu-edge-label',
              html: `<div style="transform:translate(-50%,-50%);padding:1px 5px;border-radius:4px;background:rgba(2,3,5,0.9);color:#67E8F9;border:1px solid rgba(56,189,248,0.5);font-family:monospace;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.65);">${edge.lengthMeters.toFixed(1)} m</div>`,
              iconSize: [0, 0],
            }),
          }).addTo(gisLayer);
        });
      }
    }

    // Draggable Center Pin
    if (pinPosition) {
      const centerMarker = L.marker([pinPosition.lat, pinPosition.lng], {
        draggable: true,
        zIndexOffset: 350,
        title: 'Land Center Pin (drag to move)',
        icon: L.divIcon({
          className: 'anagu-center-pin',
          html: `<div style="transform:translate(-50%,-50%);width:16px;height:16px;border-radius:9999px;background:#38BDF8;border:3px solid #020305;box-shadow:0 0 14px rgba(56,189,248,0.9);cursor:grab;"></div>`,
          iconSize: [0, 0],
        }),
      });
      centerMarker.on('dragend', () => {
        const next = centerMarker.getLatLng();
        onPinDragEndRef.current({ lat: next.lat, lng: next.lng });
      });
      centerMarker.addTo(gisLayer);
    }
  }, [
    toolMode,
    draftVertices,
    polygonVertices,
    pinPosition,
    isOverlapping,
    edgeMeasurements,
  ]);

  return <div ref={containerRef} className="h-full w-full" />;
}
