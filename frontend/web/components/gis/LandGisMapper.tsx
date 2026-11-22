'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eraser,
  Hand,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  PenTool,
  RotateCcw,
  Ruler,
  Shapes,
  X,
} from 'lucide-react';
import { PlaceSearchBox, type SelectedPlaceResult } from './PlaceSearchBox';
import type { MapViewCommand, OpenMapControllerApi } from './OpenMapGisCanvas';
import {
  NIGERIA_DEFAULT_CENTER,
  NIGERIA_GIS_HUBS,
  NIGERIA_PLOT_PRESETS,
  captureParcelMapSnapshot,
  computeEdgeMeasurements,
  computePerimeterFallback,
  computePolygonCentroid,
  computeSphericalAreaFallback,
  createRectangleAroundPoint,
  doPolygonsOverlap,
  formatCoordinateString,
  formatPlotEquivalents,
  toGeoJsonPolygon,
  type LatLngPoint,
} from '@/lib/gis-utils';
import {
  OPEN_MAP_LAYERS,
  type OpenMapLayerId,
} from '@/lib/openmap-tiles';
import type { LandListing } from '@/lib/land-store';

const OpenMapGisCanvas = dynamic(() => import('./OpenMapGisCanvas'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-[#05080D] text-xs text-[#94A3B8] gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
      <span>Loading interactive GIS map…</span>
    </div>
  ),
});

export interface GisMeasurementPayload {
  areaSqm: number | null;
  perimeterMeters: number | null;
  coordinates: string;
  lat: number | null;
  lng: number | null;
  polygon: LatLngPoint[];
  mapSnapshotDataUrl?: string | null;
  layerId?: OpenMapLayerId;
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

const QUICK_AREAS = NIGERIA_GIS_HUBS.slice(0, 6);

export function LandGisMapper({
  existingParcels,
  parcelTitle,
  onGisChange,
  resetSignal = 0,
  isVisible = true,
}: LandGisMapperProps) {
  const mapApiRef = useRef<OpenMapControllerApi | null>(null);

  const [layerId, setLayerId] = useState<OpenMapLayerId>('hybrid');
  const [toolMode, setToolMode] = useState<'draw_polygon' | 'drop_pin' | 'pan'>('draw_polygon');
  const [showRegistryOverlay, setShowRegistryOverlay] = useState(true);
  const [selectedExistingParcel, setSelectedExistingParcel] = useState<LandListing | null>(null);

  // Camera & telemetry state
  const [viewCommand, setViewCommand] = useState<MapViewCommand | null>(null);
  const viewSeqRef = useRef(0);
  const [cursorCoords, setCursorCoords] = useState<LatLngPoint | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(6);

  // Address / GPS locate state
  const [locatedAddress, setLocatedAddress] = useState<string>('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Spatial boundary states
  const [draftVertices, setDraftVertices] = useState<LatLngPoint[]>([]);
  const [polygonVertices, setPolygonVertices] = useState<LatLngPoint[]>([]);
  const [pinPosition, setPinPosition] = useState<LatLngPoint | null>(null);

  const [geoJsonCopied, setGeoJsonCopied] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [mapSnapshotUrl, setMapSnapshotUrl] = useState<string | null>(null);
  const [capturingSnapshot, setCapturingSnapshot] = useState(false);

  const issueViewCommand = useCallback(
    (
      cmd:
        | { type: 'pan'; center: LatLngPoint; zoom?: number }
        | { type: 'fitBounds'; points: LatLngPoint[] }
        | { type: 'fitBox'; box: [[number, number], [number, number]] },
    ) => {
      viewSeqRef.current += 1;
      setViewCommand({ ...cmd, seq: viewSeqRef.current });
    },
    [],
  );

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
    setDraftVertices([]);
    setPolygonVertices([]);
    setPinPosition(null);
    setLocatedAddress('');
    setGpsError(null);
    setGeoStatus(null);
    setSelectedExistingParcel(null);
    setMapSnapshotUrl(null);
    setCapturingSnapshot(false);
    setToolMode('draw_polygon');
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

  const runSnapshotCapture = useCallback(
    async (poly: LatLngPoint[], center: LatLngPoint | null, activeLayer: OpenMapLayerId) => {
      if (poly.length < 3 && !center) {
        setMapSnapshotUrl(null);
        return;
      }
      setCapturingSnapshot(true);
      try {
        const snapshot = await captureParcelMapSnapshot({
          polygon: poly,
          center,
          layerId: activeLayer,
        });
        setMapSnapshotUrl(snapshot);
      } finally {
        setCapturingSnapshot(false);
      }
    },
    [],
  );

  // Automatically capture map picture whenever plot boundaries, center pin, or map layer changes
  useEffect(() => {
    if (polygonVertices.length < 3 && !pinPosition) {
      setMapSnapshotUrl(null);
      setCapturingSnapshot(false);
      return;
    }

    let cancelled = false;
    setCapturingSnapshot(true);
    const timer = window.setTimeout(() => {
      void captureParcelMapSnapshot({
        polygon: polygonVertices,
        center: measurements.centroid ?? pinPosition,
        layerId,
      }).then((snapshot) => {
        if (!cancelled) {
          setMapSnapshotUrl(snapshot);
          setCapturingSnapshot(false);
        }
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [polygonVertices, pinPosition, measurements.centroid, layerId]);

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
      mapSnapshotDataUrl: mapSnapshotUrl,
      layerId,
    });
  }, [measurements, polygonVertices, mapSnapshotUrl, layerId]);

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

  const handlePlaceSelect = useCallback(
    (result: SelectedPlaceResult) => {
      setGpsError(null);
      const center = { lat: result.lat, lng: result.lng };
      setLocatedAddress(result.formattedAddress);

      if (polygonVertices.length === 0) {
        setPinPosition(center);
      }

      if (result.boundingBox) {
        issueViewCommand({ type: 'fitBox', box: result.boundingBox });
      } else {
        issueViewCommand({ type: 'pan', center, zoom: 17 });
      }

      setToolMode('draw_polygon');
      setGeoStatus(
        `Showing ${result.displayName} on map — click the corners of your land to draw its boundary.`,
      );

      onGisChangeRef.current({
        areaSqm: measurements.areaSqm,
        perimeterMeters: measurements.perimeterMeters,
        coordinates: formatCoordinateString(center.lat, center.lng),
        lat: center.lat,
        lng: center.lng,
        polygon: polygonVertices,
        mapSnapshotDataUrl: mapSnapshotUrl,
        layerId,
        suggestedLocation: result.formattedAddress,
        suggestedState: result.matchedState ?? undefined,
      });
    },
    [issueViewCommand, layerId, mapSnapshotUrl, measurements.areaSqm, measurements.perimeterMeters, polygonVertices],
  );

  const handleQuickAreaSelect = (hub: (typeof NIGERIA_GIS_HUBS)[number]) => {
    setGpsError(null);
    setLocatedAddress(`${hub.label}, ${hub.state}`);
    if (polygonVertices.length === 0) {
      setPinPosition(hub.center);
    }
    issueViewCommand({ type: 'pan', center: hub.center, zoom: hub.zoom });
    setToolMode('draw_polygon');
    setGeoStatus(`Showing ${hub.label} — click the corners of your land on the map to draw it.`);

    onGisChangeRef.current({
      areaSqm: measurements.areaSqm,
      perimeterMeters: measurements.perimeterMeters,
      coordinates: formatCoordinateString(hub.center.lat, hub.center.lng),
      lat: hub.center.lat,
      lng: hub.center.lng,
      polygon: polygonVertices,
      mapSnapshotDataUrl: mapSnapshotUrl,
      layerId,
      suggestedLocation: hub.label,
      suggestedState: hub.state,
    });
  };

  const handleUseCurrentGps = () => {
    setGpsError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('GPS location is not available on this device/browser.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPinPosition(pt);
        issueViewCommand({ type: 'pan', center: pt, zoom: 18 });
        setToolMode('draw_polygon');
        setGeoStatus('Centered on your GPS location — now click the corners of your land.');
        setLocatingGps(false);
      },
      () => {
        setGpsError('Could not access GPS permission. Search your street or neighborhood instead.');
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleAddDraftVertex = useCallback(
    (pt: LatLngPoint) => {
      setPolygonVertices([]);
      setDraftVertices((prev) => {
        const next = [...prev, pt];
        setGeoStatus(
          next.length < 3
            ? `Corner ${next.length} placed. Click ${3 - next.length} more ${3 - next.length === 1 ? 'corner' : 'corners'} (or keep adding corners).`
            : `${next.length} corners placed. Click corner 1 (green) or "Finish Drawing" to close.`,
        );
        return next;
      });
    },
    [],
  );

  const handleFinishDraft = useCallback(() => {
    setDraftVertices((prev) => {
      if (prev.length < 3) return prev;
      handlePolygonPathChange(prev);
      setToolMode('pan');
      setGeoStatus('Boundary drawn! Drag any corner (C1–C4) or center pin to fine-tune.');
      return [];
    });
  }, [handlePolygonPathChange]);

  const handleUndoDraft = () => {
    setDraftVertices((prev) => {
      const next = prev.slice(0, -1);
      setGeoStatus(
        next.length === 0
          ? 'Drawing reset. Click the first corner of your land on the map.'
          : `Removed last corner (${next.length} placed).`,
      );
      return next;
    });
  };

  const handlePinDrop = useCallback(
    (pt: LatLngPoint) => {
      const prevCenter = pinPosition;
      setPinPosition(pt);
      if (prevCenter && polygonVertices.length >= 3) {
        const dLat = pt.lat - prevCenter.lat;
        const dLng = pt.lng - prevCenter.lng;
        handlePolygonPathChange(
          polygonVertices.map((v) => ({ lat: v.lat + dLat, lng: v.lng + dLng })),
        );
      }
      setGeoStatus('Land pin updated.');
    },
    [pinPosition, polygonVertices, handlePolygonPathChange],
  );

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
        setGeoStatus('Moved drawn land boundary to new pin position.');
      }
    },
    [pinPosition, polygonVertices, handlePolygonPathChange],
  );

  const handleCornerDrag = useCallback(
    (idx: number, nextPt: LatLngPoint) => {
      const updated = polygonVertices.map((vertex, i) => (i === idx ? nextPt : vertex));
      handlePolygonPathChange(updated);
      setGeoStatus(`Adjusted corner C${idx + 1}.`);
    },
    [polygonVertices, handlePolygonPathChange],
  );

  const handleStampPreset = (preset: (typeof NIGERIA_PLOT_PRESETS)[number]) => {
    const mapCenter = mapApiRef.current?.getCenter();
    const anchor =
      pinPosition ||
      (mapCenter &&
      (Math.abs(mapCenter.lat - NIGERIA_DEFAULT_CENTER.lat) > 0.05 || mapZoom >= 12)
        ? mapCenter
        : NIGERIA_GIS_HUBS[0].center);

    const corners = createRectangleAroundPoint(anchor, preset.widthM, preset.lengthM);
    setDraftVertices([]);
    handlePolygonPathChange(corners);
    setToolMode('pan');
    issueViewCommand({ type: 'fitBounds', points: corners });
    setGeoStatus(
      `Placed ${preset.label} on map — drag corners C1–C4 or center pin to fit your exact plot.`,
    );
  };

  const handleClearBoundary = () => {
    setDraftVertices([]);
    setPolygonVertices([]);
    setMapSnapshotUrl(null);
    setToolMode('draw_polygon');
    setGeoStatus('Drawing cleared. Click corners on the map to draw your land boundary.');
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
      {/* 1. Search Land Address First */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <PlaceSearchBox
              onPlaceSelect={handlePlaceSelect}
              placeholder="Search your street, estate, town, or address (e.g. Admiralty Way, Lekki Phase 1)..."
            />
          </div>
          <button
            type="button"
            onClick={handleUseCurrentGps}
            disabled={locatingGps}
            className="h-11 px-4 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.30)] hover:border-[#38BDF8] text-xs font-medium text-[#67E8F9] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            {locatingGps ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            <span>Use My GPS</span>
          </button>
        </div>

        {gpsError && <p className="text-xs text-amber-300">{gpsError}</p>}

        {/* Quick Location Jump Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[#64748B] mr-1">Jump to area:</span>
          {QUICK_AREAS.map((hub) => (
            <button
              key={hub.label}
              type="button"
              onClick={() => handleQuickAreaSelect(hub)}
              className="px-2.5 py-1 rounded-md bg-[#05080D] border border-[rgba(91,133,167,0.22)] text-[11px] text-[#94A3B8] hover:text-[#67E8F9] hover:border-[#38BDF8]/50 whitespace-nowrap shrink-0 transition-colors"
            >
              {hub.label}
            </button>
          ))}
        </div>

        {locatedAddress && (
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Located: <strong className="text-[#F4F7FB]">{locatedAddress}</strong>
            </span>
          </div>
        )}
      </div>

      {/* 2. Interactive GIS Drawing & Layer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setToolMode('draw_polygon')}
            className={`h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              toolMode === 'draw_polygon'
                ? 'bg-[#38BDF8] text-[#020305] border-[#67E8F9] font-semibold'
                : 'bg-[#05080D] border-[rgba(91,133,167,0.28)] text-[#E2E8F0] hover:border-[#38BDF8]/60'
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>Draw Land on Map</span>
          </button>

          <button
            type="button"
            onClick={() => setToolMode('pan')}
            className={`h-9 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              toolMode === 'pan'
                ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#67E8F9]'
                : 'bg-[#05080D] border-[rgba(91,133,167,0.24)] text-[#94A3B8] hover:text-[#F4F7FB]'
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
            <span>Move / Drag Corners</span>
          </button>

          {draftVertices.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleUndoDraft}
                className="h-9 px-2.5 rounded-lg bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-xs text-[#E2E8F0] hover:border-[#38BDF8] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
              {draftVertices.length >= 3 && (
                <button
                  type="button"
                  onClick={handleFinishDraft}
                  className="h-9 px-3 rounded-lg bg-emerald-400 text-[#020305] text-xs font-semibold hover:bg-emerald-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Finish Boundary ({draftVertices.length})</span>
                </button>
              )}
            </>
          )}

          {(polygonVertices.length > 0 || draftVertices.length > 0) && (
            <button
              type="button"
              onClick={handleClearBoundary}
              className="h-9 px-2.5 rounded-lg bg-[#05080D] border border-rose-500/30 text-xs text-rose-300 hover:border-rose-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Map Layer + Existing Overlay Controls */}
        <div className="flex flex-wrap items-center gap-2">
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
            className={`h-8 px-2.5 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              showRegistryOverlay
                ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
                : 'bg-[#05080D] border-[rgba(91,133,167,0.22)] text-[#64748B]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Existing Plots</span>
          </button>
        </div>
      </div>

      {/* Quick Plot Shape Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-[#94A3B8] inline-flex items-center gap-1 mr-1">
          <Shapes className="h-3.5 w-3.5 text-[#38BDF8]" />
          Quick draw at map center:
        </span>
        {NIGERIA_PLOT_PRESETS.slice(0, 4).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleStampPreset(preset)}
            className="px-2.5 py-1 rounded-md bg-[#05080D] border border-[rgba(91,133,167,0.24)] text-[11px] text-[#E2E8F0] hover:border-[#38BDF8] hover:text-[#67E8F9] whitespace-nowrap shrink-0 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* 3. OpenMap + Leaflet Interactive GIS Canvas */}
      <div className="relative h-[400px] lg:h-[460px] w-full rounded-[10px] overflow-hidden border border-[rgba(91,133,167,0.28)] bg-[#05080D]">
        <OpenMapGisCanvas
          layerId={layerId}
          toolMode={toolMode}
          isVisible={isVisible}
          viewCommand={viewCommand}
          showRegistryOverlay={showRegistryOverlay}
          existingParcels={existingParcels}
          draftVertices={draftVertices}
          polygonVertices={polygonVertices}
          pinPosition={pinPosition}
          isOverlapping={overlappingParcels.length > 0}
          edgeMeasurements={edgeMeasurements}
          onMapReady={(api) => {
            mapApiRef.current = api;
          }}
          onCursorMove={setCursorCoords}
          onZoomChange={setMapZoom}
          onPinDrop={handlePinDrop}
          onPinDragEnd={handlePinDragEnd}
          onAddDraftVertex={handleAddDraftVertex}
          onFinishDraft={handleFinishDraft}
          onCornerDrag={handleCornerDrag}
          onSelectExistingParcel={(parcel) => setSelectedExistingParcel(parcel)}
        />

        {/* Top-Right Telemetry Readout */}
        <div className="pointer-events-none absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md bg-[#020305]/85 backdrop-blur-md border border-[rgba(91,133,167,0.32)] px-2.5 py-1 text-[11px] font-mono tabular-nums text-[#67E8F9]">
          <span>Z{mapZoom}</span>
          {cursorCoords && (
            <>
              <span className="text-[#475569]">/</span>
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

        {/* Floating Step-by-Step Map Prompt */}
        <div className="pointer-events-none absolute bottom-8 left-3 right-14 z-20 flex flex-wrap items-center gap-2">
          <div className="pointer-events-auto rounded-lg bg-[#020305]/90 backdrop-blur-md border border-[rgba(91,133,167,0.32)] px-3 py-1.5 text-[11px] text-[#E2E8F0]">
            {geoStatus ? (
              <span>{geoStatus}</span>
            ) : polygonVertices.length >= 3 ? (
              <span>
                <strong className="text-[#38BDF8]">Boundary Ready:</strong> Drag corners C1–C{polygonVertices.length} or the center pin to adjust.
              </span>
            ) : toolMode === 'draw_polygon' ? (
              <span>
                <strong className="text-[#38BDF8]">Draw Mode:</strong> Search your address above, then click each corner of your land on the map.
              </span>
            ) : (
              <span>
                <strong className="text-[#38BDF8]">Pan Mode:</strong> Switch to &ldquo;Draw Land on Map&rdquo; or tap a quick plot size above.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Live Spatial Measurement Summary */}
      <div className="rounded-[10px] bg-[#05080D] border border-[rgba(91,133,167,0.22)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[rgba(91,133,167,0.14)]">
          <div className="flex items-center gap-2 text-xs font-medium text-[#38BDF8]">
            <Ruler className="h-4 w-4" />
            <span>Measured Land Size &amp; Overlap Verification (Auto-Filled)</span>
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
                    <span className="text-emerald-400">Copied</span>
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
                : 'Draw on map or enter size next'}
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
                ? `${polygonVertices.length} corners drawn`
                : 'Click corners on map'}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-[#64748B]">GPS &amp; Overlap Status</p>
            <p className="font-mono font-medium text-[#F4F7FB] mt-0.5 truncate text-xs">
              {measurements.coordinates || 'Search address or click map'}
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
                  Clear — No overlap
                </span>
              ) : (
                <span className="text-[#64748B]">Draws automatically verify overlap</span>
              )}
            </div>
          </div>
        </div>

        {(polygonVertices.length >= 3 || pinPosition) && (
          <div className="mt-3 pt-3 border-t border-[rgba(91,133,167,0.14)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {mapSnapshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mapSnapshotUrl}
                  alt="Captured OpenMap plot preview"
                  className="h-14 w-[75px] rounded-md object-cover border border-[#38BDF8]/45 shrink-0 bg-[#020305]"
                />
              ) : (
                <div className="h-14 w-[75px] rounded-md border border-[rgba(91,133,167,0.28)] bg-[#020305] flex items-center justify-center shrink-0">
                  {capturingSnapshot ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#38BDF8]" />
                  ) : (
                    <Camera className="h-4 w-4 text-[#64748B]" />
                  )}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#F4F7FB] flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-[#38BDF8] shrink-0" />
                  <span>
                    {capturingSnapshot
                      ? 'Capturing map preview…'
                      : mapSnapshotUrl
                        ? 'Map Snapshot Attached'
                        : 'Ready to capture map preview'}
                  </span>
                </p>
                <p className="text-[11px] text-[#64748B]">
                  Automatically used as this land&apos;s photo on Explore Land.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={capturingSnapshot}
              onClick={() =>
                void runSnapshotCapture(
                  polygonVertices,
                  measurements.centroid ?? pinPosition,
                  layerId,
                )
              }
              className="h-8 px-3 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.28)] text-[11px] font-medium text-[#67E8F9] hover:border-[#38BDF8] disabled:opacity-60 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>{mapSnapshotUrl ? 'Re-capture' : 'Capture'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LandGisMapper;
