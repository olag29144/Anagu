'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Crosshair,
  Download,
  Eraser,
  Layers,
  MapPin,
  MousePointer2,
  Navigation,
  Pentagon,
  Ruler,
  SlidersHorizontal,
  Square,
  Undo2,
  UploadCloud,
  X,
} from 'lucide-react';
import { PlaceSearchBox, type SelectedPlaceResult } from './PlaceSearchBox';
import type {
  MapViewCommand,
  OpenMapControllerApi,
} from './OpenMapGisCanvas';
import {
  NIGERIA_GIS_HUBS,
  NIGERIA_PLOT_PRESETS,
  computeEdgeMeasurements,
  computeFourCornerPolygonFromDimensions,
  computePerimeterFallback,
  computePolygonCentroid,
  computeSphericalAreaFallback,
  createRectangleAroundPoint,
  doPolygonsOverlap,
  formatCoordinateString,
  formatPlotEquivalents,
  haversineDistanceMeters,
  parsePolygonInput,
  toGeoJsonPolygon,
  type LatLngPoint,
} from '@/lib/gis-utils';
import { OPEN_MAP_LAYERS, type OpenMapLayerId } from '@/lib/openmap-tiles';
import type { LandListing } from '@/lib/land-store';

const OpenMapGisCanvas = dynamic(() => import('./OpenMapGisCanvas'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#05080D] flex items-center justify-center text-xs font-mono text-[#94A3B8] animate-pulse">
      Initializing OpenStreetMap GIS Engine…
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

type ToolMode = 'draw_polygon' | 'drop_pin' | 'pan';
type MapperTab = 'dimensions' | 'draw' | 'survey';

interface SideDimensionsState {
  north: string;
  east: string;
  south: string;
  west: string;
}

interface CornerCoordInput {
  lat: string;
  lng: string;
}

const EMPTY_CORNER_INPUTS: [
  CornerCoordInput,
  CornerCoordInput,
  CornerCoordInput,
  CornerCoordInput,
] = [
  { lat: '', lng: '' },
  { lat: '', lng: '' },
  { lat: '', lng: '' },
  { lat: '', lng: '' },
];

export function LandGisMapper({
  existingParcels,
  parcelTitle,
  onGisChange,
  resetSignal = 0,
  isVisible = true,
}: LandGisMapperProps) {
  const mapApiRef = useRef<OpenMapControllerApi | null>(null);
  const geoJsonFileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<MapperTab>('dimensions');
  const [toolMode, setToolMode] = useState<ToolMode>('drop_pin');
  const [layerId, setLayerId] = useState<OpenMapLayerId>('osm');
  const [showRegistryOverlay, setShowRegistryOverlay] = useState(true);
  const [selectedExistingParcel, setSelectedExistingParcel] = useState<LandListing | null>(null);
  const [showCenterAdvanced, setShowCenterAdvanced] = useState(false);

  // Camera & telemetry state
  const [viewCommand, setViewCommand] = useState<MapViewCommand | null>(null);
  const viewSeqRef = useRef(0);
  const [cursorCoords, setCursorCoords] = useState<LatLngPoint | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(6);

  // Spatial drawing states
  const [draftVertices, setDraftVertices] = useState<LatLngPoint[]>([]);
  const [polygonVertices, setPolygonVertices] = useState<LatLngPoint[]>([]);
  const [pinPosition, setPinPosition] = useState<LatLngPoint | null>(null);

  // Plot stamp, 4-corner dimensions, & import UI states
  const [customWidthM, setCustomWidthM] = useState('18');
  const [customLengthM, setCustomLengthM] = useState('36');
  const [centerLatInput, setCenterLatInput] = useState('');
  const [centerLngInput, setCenterLngInput] = useState('');
  const [sideDimensions, setSideDimensions] = useState<SideDimensionsState>({
    north: '',
    east: '',
    south: '',
    west: '',
  });
  const [bearingDeg, setBearingDeg] = useState('0');
  const [dimensionError, setDimensionError] = useState<string | null>(null);
  const [cornerInputs, setCornerInputs] = useState<
    [CornerCoordInput, CornerCoordInput, CornerCoordInput, CornerCoordInput]
  >(EMPTY_CORNER_INPUTS);
  const [cornerCoordError, setCornerCoordError] = useState<string | null>(null);

  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [geoJsonCopied, setGeoJsonCopied] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const sideDimensionsRef = useRef<SideDimensionsState>(sideDimensions);
  const bearingDegRef = useRef<string>(bearingDeg);
  const draftVerticesRef = useRef<LatLngPoint[]>(draftVertices);
  const toolModeRef = useRef<ToolMode>(toolMode);
  sideDimensionsRef.current = sideDimensions;
  bearingDegRef.current = bearingDeg;
  draftVerticesRef.current = draftVertices;
  toolModeRef.current = toolMode;

  const issuePan = useCallback((center: LatLngPoint, zoom?: number) => {
    viewSeqRef.current += 1;
    setViewCommand({ type: 'pan', center, zoom, seq: viewSeqRef.current });
  }, []);

  const fitMapToPolygon = useCallback((points: LatLngPoint[]) => {
    if (points.length === 0) return;
    viewSeqRef.current += 1;
    setViewCommand({ type: 'fitBounds', points, seq: viewSeqRef.current });
  }, []);

  const fitMapToBox = useCallback((box: [[number, number], [number, number]]) => {
    viewSeqRef.current += 1;
    setViewCommand({ type: 'fitBox', box, seq: viewSeqRef.current });
  }, []);

  const syncInputsFromPolygon = useCallback(
    (points: LatLngPoint[], overrideCenter?: LatLngPoint | null) => {
      const centroid = overrideCenter ?? computePolygonCentroid(points);
      if (centroid) {
        setCenterLatInput(centroid.lat.toFixed(6));
        setCenterLngInput(centroid.lng.toFixed(6));
      }

      if (points.length >= 3) {
        setCornerInputs([
          { lat: points[0].lat.toFixed(6), lng: points[0].lng.toFixed(6) },
          { lat: points[1].lat.toFixed(6), lng: points[1].lng.toFixed(6) },
          { lat: points[2].lat.toFixed(6), lng: points[2].lng.toFixed(6) },
          points[3]
            ? { lat: points[3].lat.toFixed(6), lng: points[3].lng.toFixed(6) }
            : { lat: '', lng: '' },
        ]);
        setCornerCoordError(null);
      }

      if (points.length === 4) {
        const edges = computeEdgeMeasurements(points);
        if (edges.length === 4) {
          setSideDimensions({
            north: edges[0].lengthMeters.toFixed(1),
            east: edges[1].lengthMeters.toFixed(1),
            south: edges[2].lengthMeters.toFixed(1),
            west: edges[3].lengthMeters.toFixed(1),
          });
          setDimensionError(null);
        }
      }
    },
    [],
  );

  const handlePolygonPathChange = useCallback(
    (nextPaths: LatLngPoint[]) => {
      setPolygonVertices(nextPaths);
      const nextCentroid = computePolygonCentroid(nextPaths);
      if (nextCentroid) {
        setPinPosition(nextCentroid);
      }
      syncInputsFromPolygon(nextPaths, nextCentroid);
    },
    [syncInputsFromPolygon],
  );

  // Reset when parent resets form
  useEffect(() => {
    if (resetSignal === 0) return;
    setDraftVertices([]);
    setPolygonVertices([]);
    setPinPosition(null);
    setActiveTab('dimensions');
    setToolMode('drop_pin');
    setCenterLatInput('');
    setCenterLngInput('');
    setSideDimensions({ north: '', east: '', south: '', west: '' });
    setBearingDeg('0');
    setDimensionError(null);
    setCornerInputs(EMPTY_CORNER_INPUTS);
    setCornerCoordError(null);
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

  const finishPolygon = useCallback(
    (points: LatLngPoint[]) => {
      if (points.length < 3) return;
      setPolygonVertices(points);
      setDraftVertices([]);
      const centroid = computePolygonCentroid(points);
      if (centroid) setPinPosition(centroid);
      syncInputsFromPolygon(points, centroid);
      setToolMode('pan');
      setGeoStatus('Land boundary marked on OpenMap. Drag any corner badge (C1–C4) to adjust.');
    },
    [syncInputsFromPolygon],
  );

  // Keyboard shortcuts: Enter to finish polygon, Escape to cancel draft
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        toolModeRef.current === 'draw_polygon' &&
        draftVerticesRef.current.length >= 3
      ) {
        e.preventDefault();
        finishPolygon(draftVerticesRef.current);
      } else if (e.key === 'Escape' && draftVerticesRef.current.length > 0) {
        setDraftVertices([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finishPolygon]);

  const applyFourSideDimensions = useCallback(
    (
      nextCenterLatStr: string,
      nextCenterLngStr: string,
      nextSides: SideDimensionsState,
      nextBearingStr: string,
      options?: {
        fallbackToDefaultAnchor?: boolean;
        fitBounds?: boolean;
        syncCenterFields?: boolean;
      },
    ) => {
      const n = parseFloat(nextSides.north);
      const e = parseFloat(nextSides.east);
      const s = parseFloat(nextSides.south);
      const w = parseFloat(nextSides.west);

      const allFilled =
        nextSides.north.trim() !== '' &&
        nextSides.east.trim() !== '' &&
        nextSides.south.trim() !== '' &&
        nextSides.west.trim() !== '';

      if (!allFilled) {
        setDimensionError(null);
        return false;
      }

      if (
        !Number.isFinite(n) ||
        !Number.isFinite(e) ||
        !Number.isFinite(s) ||
        !Number.isFinite(w) ||
        n <= 0 ||
        e <= 0 ||
        s <= 0 ||
        w <= 0
      ) {
        setDimensionError('All four side sizes must be positive numbers in meters.');
        return false;
      }

      const parsedLat = parseFloat(nextCenterLatStr);
      const parsedLng = parseFloat(nextCenterLngStr);
      const hasValidExplicitCenter =
        nextCenterLatStr.trim() !== '' &&
        nextCenterLngStr.trim() !== '' &&
        Number.isFinite(parsedLat) &&
        Number.isFinite(parsedLng) &&
        parsedLat >= -90 &&
        parsedLat <= 90 &&
        parsedLng >= -180 &&
        parsedLng <= 180;

      let center: LatLngPoint | null = hasValidExplicitCenter
        ? { lat: parsedLat, lng: parsedLng }
        : pinPosition;

      if (!center && options?.fallbackToDefaultAnchor) {
        const zoom = mapApiRef.current?.getZoom() ?? 6;
        const mapCenter = mapApiRef.current?.getCenter();
        center = zoom >= 11 && mapCenter ? mapCenter : { lat: 6.4474, lng: 3.4723 };
      }

      if (!center) {
        return false;
      }

      if (options?.syncCenterFields !== false && !hasValidExplicitCenter) {
        setCenterLatInput(center.lat.toFixed(6));
        setCenterLngInput(center.lng.toFixed(6));
      }

      const bearing = Number.isFinite(parseFloat(nextBearingStr)) ? parseFloat(nextBearingStr) : 0;
      const solved = computeFourCornerPolygonFromDimensions(center, n, e, s, w, bearing);
      if (solved.error || solved.corners.length !== 4) {
        setDimensionError(solved.error || 'Unable to compute 4-corner polygon.');
        return false;
      }

      setDimensionError(null);
      setCornerCoordError(null);
      setDraftVertices([]);
      setPolygonVertices(solved.corners);
      setPinPosition(center);
      setToolMode('pan');
      setCornerInputs([
        { lat: solved.corners[0].lat.toFixed(6), lng: solved.corners[0].lng.toFixed(6) },
        { lat: solved.corners[1].lat.toFixed(6), lng: solved.corners[1].lng.toFixed(6) },
        { lat: solved.corners[2].lat.toFixed(6), lng: solved.corners[2].lng.toFixed(6) },
        { lat: solved.corners[3].lat.toFixed(6), lng: solved.corners[3].lng.toFixed(6) },
      ]);

      if (options?.fitBounds !== false) {
        fitMapToPolygon(solved.corners);
      }

      setGeoStatus(
        `4 corners (C1–C4) marked on OpenMap (${n.toFixed(1)}m × ${e.toFixed(1)}m × ${s.toFixed(1)}m × ${w.toFixed(1)}m).`,
      );
      return true;
    },
    [fitMapToPolygon, pinPosition],
  );

  const handlePinDropFromMap = useCallback(
    (point: LatLngPoint) => {
      setPinPosition(point);
      const latStr = point.lat.toFixed(6);
      const lngStr = point.lng.toFixed(6);
      setCenterLatInput(latStr);
      setCenterLngInput(lngStr);

      const curSides = sideDimensionsRef.current;
      const n = parseFloat(curSides.north);
      const east = parseFloat(curSides.east);
      const s = parseFloat(curSides.south);
      const w = parseFloat(curSides.west);
      if (n > 0 && east > 0 && s > 0 && w > 0) {
        const bearing = Number.isFinite(parseFloat(bearingDegRef.current))
          ? parseFloat(bearingDegRef.current)
          : 0;
        const solved = computeFourCornerPolygonFromDimensions(point, n, east, s, w, bearing);
        if (!solved.error && solved.corners.length === 4) {
          setPolygonVertices(solved.corners);
          setCornerInputs([
            { lat: solved.corners[0].lat.toFixed(6), lng: solved.corners[0].lng.toFixed(6) },
            { lat: solved.corners[1].lat.toFixed(6), lng: solved.corners[1].lng.toFixed(6) },
            { lat: solved.corners[2].lat.toFixed(6), lng: solved.corners[2].lng.toFixed(6) },
            { lat: solved.corners[3].lat.toFixed(6), lng: solved.corners[3].lng.toFixed(6) },
          ]);
          setToolMode('pan');
          fitMapToPolygon(solved.corners);
          setGeoStatus('Pin moved and 4-corner land boundary marked at this spot.');
          return;
        }
      }
      setGeoStatus('Land spot pinned! Enter your 4 side sizes in meters or tap a plot preset.');
    },
    [fitMapToPolygon],
  );

  const handlePinDragEnd = useCallback(
    (nextPt: LatLngPoint) => {
      const prevCenter = pinPosition;
      setPinPosition(nextPt);
      setCenterLatInput(nextPt.lat.toFixed(6));
      setCenterLngInput(nextPt.lng.toFixed(6));

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

  const handleSelectTab = (tab: MapperTab) => {
    setActiveTab(tab);
    if (tab === 'draw') {
      setToolMode(polygonVertices.length < 3 ? 'draw_polygon' : 'pan');
    } else if (tab === 'dimensions') {
      setToolMode(polygonVertices.length < 3 ? 'drop_pin' : 'pan');
    } else {
      setToolMode('pan');
    }
  };

  const handlePlaceSelect = useCallback(
    (result: SelectedPlaceResult) => {
      const target = { lat: result.lat, lng: result.lng };
      const latStr = target.lat.toFixed(6);
      const lngStr = target.lng.toFixed(6);
      setPinPosition(target);
      setCenterLatInput(latStr);
      setCenterLngInput(lngStr);

      const appliedDimensions = applyFourSideDimensions(
        latStr,
        lngStr,
        sideDimensionsRef.current,
        bearingDegRef.current,
        { fitBounds: true, syncCenterFields: false },
      );

      if (!appliedDimensions) {
        if (result.boundingBox) {
          fitMapToBox(result.boundingBox);
        } else {
          issuePan(target, 16);
        }
      }

      onGisChangeRef.current({
        areaSqm: measurements.areaSqm,
        perimeterMeters: measurements.perimeterMeters,
        coordinates: formatCoordinateString(target.lat, target.lng),
        lat: target.lat,
        lng: target.lng,
        polygon: polygonVertices,
        suggestedLocation: result.formattedAddress,
        suggestedState: result.matchedState ?? undefined,
      });

      if (!appliedDimensions) {
        setGeoStatus(
          `Found ${result.displayName} on OpenStreetMap. Enter your 4 side sizes or tap a plot preset.`,
        );
      }
    },
    [
      applyFourSideDimensions,
      fitMapToBox,
      issuePan,
      measurements.areaSqm,
      measurements.perimeterMeters,
      polygonVertices,
    ],
  );

  const handleJumpHub = (hub: (typeof NIGERIA_GIS_HUBS)[number]) => {
    const latStr = hub.center.lat.toFixed(6);
    const lngStr = hub.center.lng.toFixed(6);
    setPinPosition(hub.center);
    setCenterLatInput(latStr);
    setCenterLngInput(lngStr);

    const appliedDimensions = applyFourSideDimensions(
      latStr,
      lngStr,
      sideDimensions,
      bearingDeg,
      { fitBounds: true, syncCenterFields: false },
    );

    if (!appliedDimensions) {
      issuePan(hub.center, hub.zoom);
    }

    onGisChangeRef.current({
      areaSqm: measurements.areaSqm,
      perimeterMeters: measurements.perimeterMeters,
      coordinates: formatCoordinateString(hub.center.lat, hub.center.lng),
      lat: hub.center.lat,
      lng: hub.center.lng,
      polygon: polygonVertices,
      suggestedState: hub.state,
    });

    if (!appliedDimensions) {
      setGeoStatus(
        `Jumped to ${hub.label}. Enter your 4 side sizes or tap a plot preset to mark your boundary.`,
      );
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoStatus('GPS location is not supported by this browser.');
      return;
    }
    setGeoStatus('Finding your current GPS position…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const latStr = pt.lat.toFixed(6);
        const lngStr = pt.lng.toFixed(6);
        setPinPosition(pt);
        setCenterLatInput(latStr);
        setCenterLngInput(lngStr);

        const appliedDimensions = applyFourSideDimensions(
          latStr,
          lngStr,
          sideDimensionsRef.current,
          bearingDegRef.current,
          { fitBounds: true, syncCenterFields: false },
        );

        if (!appliedDimensions) {
          issuePan(pt, 18);
          setGeoStatus('Locked onto your live GPS position. Enter 4 side sizes or tap corners.');
        }
      },
      () => {
        setGeoStatus(
          'Location access was denied. Search your town/street or tap a quick city above.',
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleUseCurrentMapCenter = () => {
    const pt = mapApiRef.current?.getCenter() ?? { lat: 6.4474, lng: 3.4723 };
    const latStr = pt.lat.toFixed(6);
    const lngStr = pt.lng.toFixed(6);
    setPinPosition(pt);
    setCenterLatInput(latStr);
    setCenterLngInput(lngStr);
    const applied = applyFourSideDimensions(latStr, lngStr, sideDimensions, bearingDeg, {
      fitBounds: true,
      syncCenterFields: false,
    });
    if (!applied) {
      setGeoStatus('Center captured from OpenMap. Enter your 4 side sizes to mark corners.');
    }
  };

  const handleSideDimensionChange = (field: keyof SideDimensionsState, value: string) => {
    const nextSides = { ...sideDimensions, [field]: value };
    setSideDimensions(nextSides);
    applyFourSideDimensions(centerLatInput, centerLngInput, nextSides, bearingDeg, {
      fallbackToDefaultAnchor: true,
      fitBounds: true,
    });
  };

  const handleCenterCoordChange = (field: 'lat' | 'lng', value: string) => {
    const nextLat = field === 'lat' ? value : centerLatInput;
    const nextLng = field === 'lng' ? value : centerLngInput;
    if (field === 'lat') setCenterLatInput(value);
    else setCenterLngInput(value);

    const parsedLat = parseFloat(nextLat);
    const parsedLng = parseFloat(nextLng);
    if (
      nextLat.trim() !== '' &&
      nextLng.trim() !== '' &&
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLng >= -180 &&
      parsedLng <= 180
    ) {
      const target = { lat: parsedLat, lng: parsedLng };
      setPinPosition(target);
      const applied = applyFourSideDimensions(nextLat, nextLng, sideDimensions, bearingDeg, {
        fitBounds: true,
        syncCenterFields: false,
      });
      if (!applied) {
        const currentZoom = mapApiRef.current?.getZoom() ?? 6;
        issuePan(target, currentZoom < 16 ? 17 : currentZoom);
      }
    }
  };

  const handleBearingChange = (nextBearing: string) => {
    setBearingDeg(nextBearing);
    applyFourSideDimensions(centerLatInput, centerLngInput, sideDimensions, nextBearing, {
      fallbackToDefaultAnchor: true,
      fitBounds: false,
    });
  };

  const handleApplyRectDimensionPreset = (widthM: number, lengthM: number, label: string) => {
    const nextSides: SideDimensionsState = {
      north: String(widthM),
      east: String(lengthM),
      south: String(widthM),
      west: String(lengthM),
    };
    setSideDimensions(nextSides);
    const applied = applyFourSideDimensions(centerLatInput, centerLngInput, nextSides, bearingDeg, {
      fallbackToDefaultAnchor: true,
      fitBounds: true,
    });
    if (applied) {
      setGeoStatus(`Marked ${label} 4-corner plot automatically on OpenMap.`);
    }
  };

  const handleCornerCoordChange = (index: number, field: 'lat' | 'lng', value: string) => {
    const nextCorners: [CornerCoordInput, CornerCoordInput, CornerCoordInput, CornerCoordInput] = [
      ...cornerInputs,
    ] as [CornerCoordInput, CornerCoordInput, CornerCoordInput, CornerCoordInput];
    nextCorners[index] = { ...nextCorners[index], [field]: value };
    setCornerInputs(nextCorners);

    const anyOutOfRange = nextCorners.some((c) => {
      const la = c.lat.trim() === '' ? null : parseFloat(c.lat);
      const ln = c.lng.trim() === '' ? null : parseFloat(c.lng);
      if (la !== null && (!Number.isFinite(la) || la < -90 || la > 90)) return true;
      if (ln !== null && (!Number.isFinite(ln) || ln < -180 || ln > 180)) return true;
      return false;
    });

    if (anyOutOfRange) {
      setCornerCoordError(
        'Latitude must be between -90 and 90, and Longitude between -180 and 180.',
      );
      return;
    }

    const parsedPts: LatLngPoint[] = [];
    for (const c of nextCorners) {
      if (c.lat.trim() === '' || c.lng.trim() === '') {
        setCornerCoordError(null);
        return;
      }
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setCornerCoordError(null);
        return;
      }
      parsedPts.push({ lat, lng });
    }

    setCornerCoordError(null);
    setDraftVertices([]);
    setPolygonVertices(parsedPts);
    const centroid = computePolygonCentroid(parsedPts);
    if (centroid) {
      setPinPosition(centroid);
      setCenterLatInput(centroid.lat.toFixed(6));
      setCenterLngInput(centroid.lng.toFixed(6));
    }
    const edges = computeEdgeMeasurements(parsedPts);
    if (edges.length === 4) {
      setSideDimensions({
        north: edges[0].lengthMeters.toFixed(1),
        east: edges[1].lengthMeters.toFixed(1),
        south: edges[2].lengthMeters.toFixed(1),
        west: edges[3].lengthMeters.toFixed(1),
      });
      setDimensionError(null);
    }
    setToolMode('pan');
    fitMapToPolygon(parsedPts);
    setGeoStatus('4 exact corner coordinates (C1–C4) marked on OpenMap.');
  };

  const handleStampPlot = (widthM: number, lengthM: number, label: string) => {
    if (Number.isNaN(widthM) || Number.isNaN(lengthM) || widthM <= 0 || lengthM <= 0) return;
    const mapCenter = mapApiRef.current?.getCenter();
    const zoom = mapApiRef.current?.getZoom() ?? 6;
    const center: LatLngPoint =
      pinPosition ?? (mapCenter && zoom >= 11 ? mapCenter : { lat: 6.4474, lng: 3.4723 });

    const rect = createRectangleAroundPoint(center, widthM, lengthM);
    setDraftVertices([]);
    setPolygonVertices(rect);
    setPinPosition(center);
    syncInputsFromPolygon(rect, center);
    setToolMode('pan');
    fitMapToPolygon(rect);
    setGeoStatus(`Stamped ${label} boundary. Drag any corner badge (C1–C4) to adjust.`);
  };

  const handleUndoVertex = () => {
    if (draftVertices.length > 0) {
      setDraftVertices((prev) => prev.slice(0, -1));
      return;
    }
    if (polygonVertices.length > 3) {
      const next = polygonVertices.slice(0, -1);
      setPolygonVertices(next);
      syncInputsFromPolygon(next);
    } else if (polygonVertices.length > 0) {
      setPolygonVertices([]);
      setToolMode(activeTab === 'draw' ? 'draw_polygon' : 'drop_pin');
    }
  };

  const handleClearBoundary = () => {
    setDraftVertices([]);
    setPolygonVertices([]);
    setSideDimensions({ north: '', east: '', south: '', west: '' });
    setDimensionError(null);
    setCornerInputs(EMPTY_CORNER_INPUTS);
    setCornerCoordError(null);
    setToolMode(activeTab === 'draw' ? 'draw_polygon' : 'drop_pin');
    setGeoStatus('Boundary cleared. Enter 4 side sizes or tap corners on OpenMap.');
  };

  const plotImportedText = (rawText: string) => {
    const parsed = parsePolygonInput(rawText);
    if (parsed.error || parsed.points.length < 3) {
      setImportError(parsed.error || 'Could not parse polygon coordinates.');
      return;
    }
    setImportError(null);
    setDraftVertices([]);
    setPolygonVertices(parsed.points);
    const centroid = computePolygonCentroid(parsed.points);
    if (centroid) setPinPosition(centroid);
    syncInputsFromPolygon(parsed.points, centroid);
    setToolMode('pan');
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
      {/* Step 1 inside Map: Find Location Easily via OpenStreetMap Nominatim */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1">
            <PlaceSearchBox
              onPlaceSelect={handlePlaceSelect}
              placeholder="Search street, town, estate, or area on OpenStreetMap (e.g. Lekki Phase 1, Abuja)..."
            />
          </div>
          <button
            type="button"
            onClick={handleLocateMe}
            className="h-11 px-4 rounded-[8px] bg-[#05080D] border border-[rgba(91,133,167,0.28)] text-xs font-medium text-[#E2E8F0] hover:border-[#38BDF8] hover:text-[#67E8F9] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <Crosshair className="h-4 w-4 text-[#38BDF8]" />
            <span>Use My GPS</span>
          </button>
        </div>

        {/* Quick City Jump Strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-[#64748B] mr-1">Popular Areas:</span>
          {NIGERIA_GIS_HUBS.map((hub) => (
            <button
              key={hub.label}
              type="button"
              onClick={() => handleJumpHub(hub)}
              className="px-2.5 py-1 rounded-md bg-[#05080D] border border-[rgba(91,133,167,0.20)] text-[11px] text-[#94A3B8] hover:text-[#F4F7FB] hover:border-[#38BDF8]/50 whitespace-nowrap shrink-0 transition-colors"
            >
              {hub.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified 3-Mode GIS Boundary Tool Switcher */}
      <div className="rounded-[10px] bg-[#05080D] border border-[rgba(91,133,167,0.25)] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#0A0F16] border border-[rgba(91,133,167,0.20)]">
            <button
              type="button"
              onClick={() => handleSelectTab('dimensions')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'dimensions'
                  ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F4F7FB]'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>By 4 Side Sizes (Easy)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('draw')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'draw'
                  ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F4F7FB]'
              }`}
            >
              <Pentagon className="h-3.5 w-3.5" />
              <span>Tap Corners on Map</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('survey')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'survey'
                  ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F4F7FB]'
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>4-Corner GPS &amp; GeoJSON Import</span>
            </button>
          </div>

          {(draftVertices.length > 0 || polygonVertices.length > 0) && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndoVertex}
                className="h-8 px-2.5 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-xs text-[#94A3B8] hover:text-[#F4F7FB] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={handleClearBoundary}
                className="h-8 px-2.5 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-xs text-rose-300 hover:border-rose-500/40 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>Clear Plot</span>
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: Easy 4 Side Dimensions */}
        {activeTab === 'dimensions' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
              <span>
                Search your area above (or tap OpenMap to place your pin), then enter the 4 sides of your land in meters — all 4 corners mark automatically.
              </span>
              <button
                type="button"
                onClick={() => setToolMode('drop_pin')}
                className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  toolMode === 'drop_pin'
                    ? 'bg-[#38BDF8]/20 border border-[#38BDF8]/50 text-[#67E8F9]'
                    : 'bg-[#0A0F16] border border-[rgba(91,133,167,0.24)] text-[#94A3B8] hover:text-[#F4F7FB]'
                }`}
              >
                <MapPin className="h-3.5 w-3.5 text-[#38BDF8]" />
                <span>{toolMode === 'drop_pin' ? 'Click Map to Set Spot' : 'Move Land Spot'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">
                  Front / Top Side (m)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={sideDimensions.north}
                  onChange={(e) => handleSideDimensionChange('north', e.target.value)}
                  placeholder="e.g. 18"
                  className="w-full h-10 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">
                  Right Side (m)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={sideDimensions.east}
                  onChange={(e) => handleSideDimensionChange('east', e.target.value)}
                  placeholder="e.g. 36"
                  className="w-full h-10 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">
                  Back / Bottom Side (m)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={sideDimensions.south}
                  onChange={(e) => handleSideDimensionChange('south', e.target.value)}
                  placeholder="e.g. 18"
                  className="w-full h-10 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">
                  Left Side (m)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={sideDimensions.west}
                  onChange={(e) => handleSideDimensionChange('west', e.target.value)}
                  placeholder="e.g. 36"
                  className="w-full h-10 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-sm font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                />
              </div>
            </div>

            {dimensionError && (
              <p className="text-xs text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{dimensionError}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[rgba(91,133,167,0.14)]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#64748B]">Quick Plot Sizes:</span>
                {[
                  { label: 'Half Plot (15×15m)', w: 15, l: 15 },
                  { label: 'Lagos Plot (15×30m)', w: 15, l: 30 },
                  { label: 'Standard Plot (18×36m)', w: 18, l: 36 },
                  { label: 'Executive (30×30m)', w: 30, l: 30 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyRectDimensionPreset(p.w, p.l, p.label)}
                    className="px-2.5 py-1 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.24)] text-[11px] text-[#E2E8F0] hover:text-[#67E8F9] hover:border-[#38BDF8]/60 whitespace-nowrap shrink-0 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowCenterAdvanced((prev) => !prev)}
                className="text-[11px] font-medium text-[#38BDF8] hover:text-[#67E8F9] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Exact Center GPS &amp; Rotation</span>
                {showCenterAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {showCenterAdvanced && (
              <div className="pt-3 border-t border-[rgba(91,133,167,0.14)] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Center Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={centerLatInput}
                    onChange={(e) => handleCenterCoordChange('lat', e.target.value)}
                    placeholder="e.g. 6.447400"
                    className="w-full h-9 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-xs font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Center Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={centerLngInput}
                    onChange={(e) => handleCenterCoordChange('lng', e.target.value)}
                    placeholder="e.g. 3.472300"
                    className="w-full h-9 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-xs font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    Rotation / Bearing (°)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="360"
                    step="1"
                    value={bearingDeg}
                    onChange={(e) => handleBearingChange(e.target.value)}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-xs font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={handleUseCurrentMapCenter}
                    className="w-full h-9 px-3 rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.26)] text-xs font-medium text-[#67E8F9] hover:border-[#38BDF8] inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>Use Map Center</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Tap Corners Directly on OpenMap + Plot Stamp */}
        {activeTab === 'draw' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setToolMode('draw_polygon')}
                className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  toolMode === 'draw_polygon'
                    ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                    : 'bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                }`}
              >
                <Pentagon className="h-3.5 w-3.5" />
                <span>Tap Corners</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('drop_pin')}
                className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  toolMode === 'drop_pin'
                    ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                    : 'bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Drop Pin</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('pan')}
                className={`h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  toolMode === 'pan'
                    ? 'bg-[#38BDF8] text-[#020305] font-semibold'
                    : 'bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[#94A3B8] hover:text-[#F4F7FB]'
                }`}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                <span>Move / Drag Plot</span>
              </button>

              {draftVertices.length >= 3 && (
                <button
                  type="button"
                  onClick={() => finishPolygon(draftVertices)}
                  className="h-9 px-3 rounded-lg bg-emerald-500 text-[#020305] text-xs font-semibold hover:bg-emerald-400 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Finish Boundary ({draftVertices.length} pts)</span>
                </button>
              )}
            </div>

            <div className="pt-2.5 border-t border-[rgba(91,133,167,0.14)] flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-[#94A3B8] inline-flex items-center gap-1">
                <Square className="h-3 w-3 text-[#38BDF8]" />
                Stamp Plot:
              </span>
              {NIGERIA_PLOT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleStampPlot(preset.widthM, preset.lengthM, preset.label)}
                  className="px-2.5 py-1 rounded-md bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[11px] text-[#E2E8F0] hover:border-[#38BDF8] hover:text-[#67E8F9] whitespace-nowrap shrink-0 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min="1"
                  value={customWidthM}
                  onChange={(e) => setCustomWidthM(e.target.value)}
                  aria-label="Custom plot width in meters"
                  className="w-14 h-7 px-2 rounded bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[11px] font-mono tabular-nums text-[#F4F7FB]"
                />
                <span className="text-[11px] text-[#64748B]">×</span>
                <input
                  type="number"
                  min="1"
                  value={customLengthM}
                  onChange={(e) => setCustomLengthM(e.target.value)}
                  aria-label="Custom plot length in meters"
                  className="w-14 h-7 px-2 rounded bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] text-[11px] font-mono tabular-nums text-[#F4F7FB]"
                />
                <span className="text-[11px] text-[#64748B]">m</span>
                <button
                  type="button"
                  onClick={() =>
                    handleStampPlot(
                      Number(customWidthM),
                      Number(customLengthM),
                      `${customWidthM}×${customLengthM}m`,
                    )
                  }
                  className="h-7 px-2.5 rounded bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[11px] font-medium text-[#67E8F9] hover:bg-[#38BDF8]/25 whitespace-nowrap shrink-0"
                >
                  Stamp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Exact 4-Corner GPS & GeoJSON / Survey Beacon Import */}
        {activeTab === 'survey' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-[#94A3B8]">
                Enter exact GPS coordinates for each of the 4 corners (C1–C4) to automatically mark your plot:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cornerInputs.map((corner, idx) => {
                  const nextIdx = (idx + 1) % 4;
                  const cA =
                    corner.lat.trim() && corner.lng.trim()
                      ? { lat: parseFloat(corner.lat), lng: parseFloat(corner.lng) }
                      : null;
                  const cB =
                    cornerInputs[nextIdx].lat.trim() && cornerInputs[nextIdx].lng.trim()
                      ? {
                          lat: parseFloat(cornerInputs[nextIdx].lat),
                          lng: parseFloat(cornerInputs[nextIdx].lng),
                        }
                      : null;
                  const sideMeters =
                    cA &&
                    cB &&
                    Number.isFinite(cA.lat) &&
                    Number.isFinite(cA.lng) &&
                    Number.isFinite(cB.lat) &&
                    Number.isFinite(cB.lng)
                      ? haversineDistanceMeters(cA, cB)
                      : null;

                  return (
                    <div
                      key={`corner-input-${idx}`}
                      className="rounded-[8px] bg-[#0A0F16] border border-[rgba(91,133,167,0.22)] p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-semibold text-[#38BDF8]">
                          Corner {idx + 1} (C{idx + 1})
                        </span>
                        <span className="font-mono tabular-nums text-[#64748B]">
                          {sideMeters !== null
                            ? `C${idx + 1}→C${nextIdx + 1}: ${sideMeters.toFixed(1)} m`
                            : `Edge C${idx + 1}→C${nextIdx + 1}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="0.000001"
                          value={corner.lat}
                          onChange={(e) => handleCornerCoordChange(idx, 'lat', e.target.value)}
                          placeholder={`C${idx + 1} Lat`}
                          aria-label={`Corner ${idx + 1} Latitude`}
                          className="h-8 px-2.5 rounded bg-[#05080D] border border-[rgba(91,133,167,0.22)] text-xs font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                        />
                        <input
                          type="number"
                          step="0.000001"
                          value={corner.lng}
                          onChange={(e) => handleCornerCoordChange(idx, 'lng', e.target.value)}
                          placeholder={`C${idx + 1} Lng`}
                          aria-label={`Corner ${idx + 1} Longitude`}
                          className="h-8 px-2.5 rounded bg-[#05080D] border border-[rgba(91,133,167,0.22)] text-xs font-mono tabular-nums text-[#F4F7FB] placeholder-[#526174] focus:border-[#38BDF8] focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {cornerCoordError && (
                <p className="text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{cornerCoordError}</span>
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[rgba(91,133,167,0.14)] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#94A3B8]">
                  Or paste / upload a GeoJSON Polygon or survey beacon coordinates (
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
        )}
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
          onPinDrop={handlePinDropFromMap}
          onPinDragEnd={handlePinDragEnd}
          onAddDraftVertex={(pt) => setDraftVertices((prev) => [...prev, pt])}
          onFinishDraft={() => finishPolygon(draftVerticesRef.current)}
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
            ) : toolMode === 'draw_polygon' ? (
              <span>
                <strong className="text-[#38BDF8]">Tap Corners:</strong> Click each corner of your
                land on OpenMap ({draftVertices.length} placed). Double-click or click{' '}
                <strong className="text-emerald-300">1</strong> to finish.
              </span>
            ) : toolMode === 'drop_pin' ? (
              <span>
                <strong className="text-[#38BDF8]">Pin Mode:</strong> Click your land on OpenMap, or enter 4 side sizes above to mark automatically.
              </span>
            ) : (
              <span>
                <strong className="text-[#38BDF8]">Edit Mode:</strong> Drag any corner badge (C1–C4) or drag the center pin to adjust.
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
                : `${draftVertices.length} points tapped`}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-[#64748B]">GPS Position &amp; Overlap Status</p>
            <p className="font-mono font-medium text-[#F4F7FB] mt-0.5 truncate text-xs">
              {measurements.coordinates || 'Search location or tap OpenMap above'}
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
                <span className="text-[#64748B]">Mark 4 corners to verify no overlap</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
