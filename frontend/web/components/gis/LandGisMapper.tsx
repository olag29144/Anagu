'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as LeafletNS from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eraser,
  Layers,
  Ruler,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  NIGERIA_DEFAULT_CENTER,
  computeEdgeMeasurements,
  computePerimeterFallback,
  computePolygonCentroid,
  computeSphericalAreaFallback,
  doPolygonsOverlap,
  formatCoordinateString,
  formatPlotEquivalents,
  parsePolygonInput,
  toGeoJsonPolygon,
  type EdgeMeasurement,
  type LatLngPoint,
} from '@/lib/gis-utils';
import {
  OPEN_MAP_LAYERS,
  createOpenMapTileLayer,
  type OpenMapLayerId,
} from '@/lib/openmap-tiles';
import type { LandListing } from '@/lib/land-store';

type MapViewCommand =
  | { type: 'pan'; center: LatLngPoint; zoom?: number; seq: number }
  | { type: 'fitBounds'; points: LatLngPoint[]; seq: number }
  | { type: 'fitBox'; box: [[number, number], [number, number]]; seq: number };

function OpenMapGisCanvasInline({
  layerId,
  isVisible,
  viewCommand,
  showRegistryOverlay,
  existingParcels,
  polygonVertices,
  pinPosition,
  isOverlapping,
  edgeMeasurements,
  onCursorMove,
  onZoomChange,
  onPinDragEnd,
  onCornerDrag,
  onSelectExistingParcel,
}: {
  layerId: OpenMapLayerId;
  isVisible: boolean;
  viewCommand: MapViewCommand | null;
  showRegistryOverlay: boolean;
  existingParcels: LandListing[];
  polygonVertices: LatLngPoint[];
  pinPosition: LatLngPoint | null;
  isOverlapping: boolean;
  edgeMeasurements: EdgeMeasurement[];
  onCursorMove?: (pt: LatLngPoint | null) => void;
  onZoomChange?: (zoom: number) => void;
  onPinDragEnd: (pt: LatLngPoint) => void;
  onCornerDrag: (index: number, pt: LatLngPoint) => void;
  onSelectExistingParcel: (parcel: LandListing) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const baseLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const registryLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const gisLayerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const onPinDragEndRef = useRef(onPinDragEnd);
  const onCornerDragRef = useRef(onCornerDrag);
  const onSelectExistingRef = useRef(onSelectExistingParcel);
  const onCursorMoveRef = useRef(onCursorMove);
  const onZoomChangeRef = useRef(onZoomChange);

  onPinDragEndRef.current = onPinDragEnd;
  onCornerDragRef.current = onCornerDrag;
  onSelectExistingRef.current = onSelectExistingParcel;
  onCursorMoveRef.current = onCursorMove;
  onZoomChangeRef.current = onZoomChange;

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

      const registryLayer = L.layerGroup().addTo(map);
      const gisLayer = L.layerGroup().addTo(map);

      map.on('mousemove', (e: LeafletNS.LeafletMouseEvent) => {
        onCursorMoveRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.on('mouseout', () => {
        onCursorMoveRef.current?.(null);
      });
      map.on('zoomend', () => {
        onZoomChangeRef.current?.(map.getZoom());
      });

      mapRef.current = map;
      registryLayerRef.current = registryLayer;
      gisLayerRef.current = gisLayer;
      onZoomChangeRef.current?.(map.getZoom());
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      baseLayerRef.current = null;
      registryLayerRef.current = null;
      gisLayerRef.current = null;
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
    if (!mapReady || !map || !L || !isVisible) return;

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
  }, [isVisible, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!mapReady || !map || !L || !viewCommand) return;

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
  }, [viewCommand, mapReady]);

  useEffect(() => {
    const layer = registryLayerRef.current;
    const L = leafletRef.current;
    if (!mapReady || !layer || !L) return;
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
            interactive: true,
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
  }, [showRegistryOverlay, existingParcels, mapReady]);

  useEffect(() => {
    const gisLayer = gisLayerRef.current;
    const L = leafletRef.current;
    if (!mapReady || !gisLayer || !L) return;

    gisLayer.clearLayers();

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
  }, [polygonVertices, pinPosition, isOverlapping, edgeMeasurements, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export interface GisMeasurementPayload {
  areaSqm: number | null;
  perimeterMeters: number | null;
  coordinates: string;
  lat: number | null;
  lng: number | null;
  polygon: LatLngPoint[];
  suggestedLocation?: string;
  suggestedState?: string;
}

interface LandGisMapperProps {
  existingParcels: LandListing[];
  parcelTitle?: string;
  onGisChange: (payload: GisMeasurementPayload) => void;
  resetSignal?: number;
  isVisible?: boolean;
}

export function LandGisMapper({
  existingParcels,
  parcelTitle,
  onGisChange,
  resetSignal = 0,
  isVisible = true,
}: LandGisMapperProps) {
  const geoJsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const [layerId, setLayerId] = useState<OpenMapLayerId>('osm');
  const [showRegistryOverlay, setShowRegistryOverlay] = useState(true);
  const [selectedExistingParcel, setSelectedExistingParcel] = useState<LandListing | null>(null);

  // Camera & telemetry state
  const [viewCommand, setViewCommand] = useState<MapViewCommand | null>(null);
  const viewSeqRef = useRef(0);
  const [cursorCoords, setCursorCoords] = useState<LatLngPoint | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(6);

  // Spatial boundary states
  const [polygonVertices, setPolygonVertices] = useState<LatLngPoint[]>([]);
  const [pinPosition, setPinPosition] = useState<LatLngPoint | null>(null);

  // GeoJSON / Survey Beacon import states
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [geoJsonCopied, setGeoJsonCopied] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const fitMapToPolygon = useCallback((points: LatLngPoint[]) => {
    if (points.length === 0) return;
    viewSeqRef.current += 1;
    setViewCommand({ type: 'fitBounds', points, seq: viewSeqRef.current });
  }, []);

  const handlePolygonPathChange = useCallback((nextPaths: LatLngPoint[]) => {
    setPolygonVertices(nextPaths);
    const nextCentroid = computePolygonCentroid(nextPaths);
    if (nextCentroid) {
      setPinPosition(nextCentroid);
    }
  }, []);

  // Reset when parent resets form
  useEffect(() => {
    if (resetSignal === 0) return;
    setPolygonVertices([]);
    setPinPosition(null);
    setImportText('');
    setImportError(null);
    setGeoStatus(null);
    setSelectedExistingParcel(null);
  }, [resetSignal]);

  // Compute spherical GIS area & perimeter
  const measurements = useMemo(() => {
    if (polygonVertices.length < 3) {
      const center = pinPosition;
      return {
        areaSqm: null as number | null,
        perimeterMeters: null as number | null,
        centroid: center,
        coordinates: center ? formatCoordinateString(center.lat, center.lng) : '',
      };
    }

    const area = Math.round(computeSphericalAreaFallback(polygonVertices));
    const perimeter = Math.round(computePerimeterFallback(polygonVertices));
    const centroid = computePolygonCentroid(polygonVertices) || pinPosition;

    return {
      areaSqm: area > 0 ? area : null,
      perimeterMeters: perimeter > 0 ? perimeter : null,
      centroid,
      coordinates: centroid ? formatCoordinateString(centroid.lat, centroid.lng) : '',
    };
  }, [polygonVertices, pinPosition]);

  // Emit spatial updates to parent registration form
  const onGisChangeRef = useRef(onGisChange);
  onGisChangeRef.current = onGisChange;

  useEffect(() => {
    onGisChangeRef.current({
      areaSqm: measurements.areaSqm,
      perimeterMeters: measurements.perimeterMeters,
      coordinates: measurements.coordinates,
      lat: measurements.centroid?.lat ?? null,
      lng: measurements.centroid?.lng ?? null,
      polygon: polygonVertices,
    });
  }, [measurements, polygonVertices]);

  const edgeMeasurements = useMemo(
    () => computeEdgeMeasurements(polygonVertices),
    [polygonVertices],
  );

  const overlappingParcels = useMemo(() => {
    if (polygonVertices.length < 3) return [];
    return existingParcels.filter(
      (parcel) =>
        parcel.polygon &&
        parcel.polygon.length >= 3 &&
        doPolygonsOverlap(polygonVertices, parcel.polygon),
    );
  }, [polygonVertices, existingParcels]);

  const handlePinDragEnd = useCallback(
    (nextPt: LatLngPoint) => {
      const prevCenter = pinPosition;
      setPinPosition(nextPt);

      if (prevCenter && polygonVertices.length >= 3) {
        const dLat = nextPt.lat - prevCenter.lat;
        const dLng = nextPt.lng - prevCenter.lng;
        const shifted = polygonVertices.map((v) => ({
          lat: v.lat + dLat,
          lng: v.lng + dLng,
        }));
        handlePolygonPathChange(shifted);
        setGeoStatus('Moved land plot to new center pin location.');
      }
    },
    [pinPosition, polygonVertices, handlePolygonPathChange],
  );

  const handleCornerDrag = useCallback(
    (idx: number, nextPt: LatLngPoint) => {
      const updated = polygonVertices.map((vertex, i) => (i === idx ? nextPt : vertex));
      handlePolygonPathChange(updated);
      setGeoStatus(`Moved Corner C${idx + 1}.`);
    },
    [polygonVertices, handlePolygonPathChange],
  );

  const handleClearBoundary = () => {
    setPolygonVertices([]);
    setPinPosition(null);
    setImportError(null);
    setGeoStatus('Boundary cleared. Paste or upload GeoJSON / survey beacon coordinates above.');
  };

  const plotImportedText = (rawText: string) => {
    const parsed = parsePolygonInput(rawText);
    if (parsed.error || parsed.points.length < 3) {
      setImportError(parsed.error || 'Could not parse polygon coordinates.');
      return;
    }
    setImportError(null);
    setPolygonVertices(parsed.points);
    const centroid = computePolygonCentroid(parsed.points);
    if (centroid) setPinPosition(centroid);
    fitMapToPolygon(parsed.points);
    setGeoStatus(`Plotted ${parsed.points.length} survey corners on OpenMap GIS.`);
  };

  const handleImportPolygon = () => {
    plotImportedText(importText);
  };

  const handleGeoJsonFileUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setImportText(text);
      plotImportedText(text);
    };
    reader.readAsText(file);
  };

  const handleCopyGeoJson = () => {
    if (polygonVertices.length < 3) return;
    const json = toGeoJsonPolygon(polygonVertices, parcelTitle || 'Anagu Land Parcel');
    void navigator.clipboard?.writeText(json);
    setGeoJsonCopied(true);
    window.setTimeout(() => setGeoJsonCopied(false), 2000);
  };

  const handleDownloadGeoJson = () => {
    if (polygonVertices.length < 3) return;
    const json = toGeoJsonPolygon(polygonVertices, parcelTitle || 'Anagu Land Parcel');
    const blob = new Blob([json], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (parcelTitle || 'anagu-parcel')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.download = `${slug || 'anagu-parcel'}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const equivalents = measurements.areaSqm
    ? formatPlotEquivalents(measurements.areaSqm)
    : null;

  return (
    <div className="space-y-4">
      {/* 4-Corner GPS & GeoJSON Import */}
      <div className="rounded-[10px] bg-[#05080D] border border-[rgba(91,133,167,0.25)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#F4F7FB]">
            <UploadCloud className="h-4 w-4 text-[#38BDF8]" />
            <span>4-Corner GPS &amp; GeoJSON Import</span>
          </div>

          {polygonVertices.length > 0 && (
            <button
              type="button"
              onClick={handleClearBoundary}
              className="h-8 px-2.5 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-xs text-rose-300 hover:border-rose-500/40 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Clear Plot</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#94A3B8]">
              Paste / upload a GeoJSON Polygon or survey beacon coordinates (
              <code className="text-[#38BDF8]">lat, lng</code> per line):
            </p>
            <input
              ref={geoJsonFileInputRef}
              type="file"
              accept=".geojson,.json,.txt,.csv"
              className="hidden"
              onChange={(e) => {
                handleGeoJsonFileUpload(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => geoJsonFileInputRef.current?.click()}
              className="h-7 px-2.5 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.28)] text-[11px] font-medium text-[#67E8F9] hover:border-[#38BDF8] inline-flex items-center gap-1.5"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Import .geojson File</span>
            </button>
          </div>
          <textarea
            rows={3}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'6.4384, 3.4719\n6.4384, 3.4724\n6.4380, 3.4724\n6.4380, 3.4719'}
            className="w-full p-2.5 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.25)] text-xs font-mono text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
          />
          {importError && <p className="text-xs text-rose-300">{importError}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleImportPolygon}
              className="h-8 px-3.5 rounded-lg bg-[#38BDF8] text-[#020305] text-xs font-semibold hover:bg-[#67E8F9] whitespace-nowrap"
            >
              Plot on OpenMap GIS
            </button>
          </div>
        </div>
      </div>

      {/* Compact OpenMap Layer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-0.5">
          {OPEN_MAP_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => setLayerId(layer.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                layerId === layer.id
                  ? 'bg-[#38BDF8]/20 text-[#67E8F9]'
                  : 'text-[#64748B] hover:text-[#E2E8F0]'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowRegistryOverlay((prev) => !prev)}
          className={`h-8 px-3 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
            showRegistryOverlay
              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
              : 'bg-[#05080D] border-[rgba(91,133,167,0.22)] text-[#64748B]'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Existing Registry Plots</span>
        </button>
      </div>

      {/* OpenMap + Leaflet GIS Canvas Container */}
      <div className="relative h-[420px] lg:h-[480px] w-full rounded-[10px] overflow-hidden border border-[rgba(91,133,167,0.28)] bg-[#05080D]">
        <OpenMapGisCanvasInline
          layerId={layerId}
          isVisible={isVisible}
          viewCommand={viewCommand}
          showRegistryOverlay={showRegistryOverlay}
          existingParcels={existingParcels}
          polygonVertices={polygonVertices}
          pinPosition={pinPosition}
          isOverlapping={overlappingParcels.length > 0}
          edgeMeasurements={edgeMeasurements}
          onCursorMove={setCursorCoords}
          onZoomChange={setMapZoom}
          onPinDragEnd={handlePinDragEnd}
          onCornerDrag={handleCornerDrag}
          onSelectExistingParcel={(parcel) => setSelectedExistingParcel(parcel)}
        />

        {/* Top-Right GIS Telemetry Pill */}
        <div className="pointer-events-none absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md bg-[#020305]/85 backdrop-blur-md border border-[rgba(91,133,167,0.32)] px-2.5 py-1 text-[11px] font-mono text-[#67E8F9]">
          <span>Z{mapZoom}</span>
          {cursorCoords && (
            <>
              <span className="text-[#475569]">|</span>
              <span>{formatCoordinateString(cursorCoords.lat, cursorCoords.lng)}</span>
            </>
          )}
        </div>

        {/* Selected Existing Registry Plot Info Card */}
        {selectedExistingParcel && (
          <div className="absolute top-3 left-14 z-20 max-w-[240px] rounded-lg bg-[#0A0F16]/95 backdrop-blur-md border border-[rgba(91,133,167,0.35)] p-3 shadow-xl space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-mono text-[#38BDF8] font-semibold">
                {selectedExistingParcel.parcelRef}
              </p>
              <button
                type="button"
                onClick={() => setSelectedExistingParcel(null)}
                className="text-[#94A3B8] hover:text-[#F4F7FB]"
                aria-label="Close existing parcel details"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs font-bold text-[#F4F7FB] leading-snug">
              {selectedExistingParcel.title}
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              {selectedExistingParcel.areaSqm.toLocaleString()} sqm · {selectedExistingParcel.state}
            </p>
          </div>
        )}

        {/* Floating Guide Bar */}
        <div className="pointer-events-none absolute bottom-8 left-3 right-14 z-20 flex flex-wrap items-center gap-2">
          <div className="pointer-events-auto rounded-lg bg-[#020305]/85 backdrop-blur-md border border-[rgba(91,133,167,0.32)] px-3 py-1.5 text-[11px] text-[#E2E8F0]">
            {geoStatus ? (
              <span>{geoStatus}</span>
            ) : polygonVertices.length >= 3 ? (
              <span>
                <strong className="text-[#38BDF8]">Edit Mode:</strong> Drag any corner badge (C1–C4) or drag the center pin to adjust.
              </span>
            ) : (
              <span>
                <strong className="text-[#38BDF8]">GeoJSON / Beacon Import:</strong> Paste or upload a GeoJSON Polygon or survey beacon coordinates above to plot on OpenMap.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Spatial Summary */}
      <div className="rounded-[10px] bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[rgba(91,133,167,0.14)]">
          <div className="flex items-center gap-2 text-xs font-medium text-[#38BDF8]">
            <Ruler className="h-4 w-4" />
            <span>Measured Land Size &amp; GIS Overlap Check (Auto-Filled)</span>
          </div>

          {polygonVertices.length >= 3 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyGeoJson}
                className="px-2.5 py-1 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[11px] font-mono text-[#94A3B8] hover:text-[#67E8F9] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {geoJsonCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">GeoJSON Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy GeoJSON</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadGeoJson}
                className="px-2.5 py-1 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[11px] font-mono text-[#94A3B8] hover:text-[#67E8F9] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>.geojson</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
          <div>
            <p className="text-[11px] text-[#64748B]">Measured Land Size</p>
            <p className="font-mono font-bold text-[#F4F7FB] mt-0.5 tabular-nums text-sm">
              {measurements.areaSqm
                ? `${measurements.areaSqm.toLocaleString()} sqm`
                : 'Not measured yet'}
            </p>
            {equivalents && (
              <p className="text-[11px] font-mono text-[#38BDF8] mt-0.5 tabular-nums">
                ~{equivalents.standardPlots648} standard plots · {equivalents.hectares} ha
              </p>
            )}
          </div>

          <div>
            <p className="text-[11px] text-[#64748B]">Boundary Perimeter</p>
            <p className="font-mono font-bold text-[#F4F7FB] mt-0.5 tabular-nums text-sm">
              {measurements.perimeterMeters
                ? `${measurements.perimeterMeters.toLocaleString()} m`
                : '—'}
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {polygonVertices.length >= 3
                ? `${polygonVertices.length} corners marked`
                : 'No corners plotted'}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-[#64748B]">GPS Position &amp; Overlap Status</p>
            <p className="font-mono font-medium text-[#F4F7FB] mt-0.5 truncate text-xs">
              {measurements.coordinates || 'Paste or upload coordinates above'}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              {overlappingParcels.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Overlaps with {overlappingParcels[0].parcelRef}
                </span>
              ) : polygonVertices.length >= 3 ? (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Clear — No overlap with existing plots
                </span>
              ) : (
                <span className="text-[#64748B]">Plot coordinates to verify no overlap</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandGisMapper;

