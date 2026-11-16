export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface NigeriaGisHub {
  label: string;
  state: string;
  center: LatLngPoint;
  zoom: number;
}

export const NIGERIA_DEFAULT_CENTER: LatLngPoint = {
  lat: 9.0765,
  lng: 7.3986,
};

export const NIGERIA_GIS_HUBS: NigeriaGisHub[] = [
  { label: 'Lekki, Lagos', state: 'Lagos State', center: { lat: 6.4474, lng: 3.4723 }, zoom: 16 },
  { label: 'Ikeja, Lagos', state: 'Lagos State', center: { lat: 6.6018, lng: 3.3515 }, zoom: 16 },
  { label: 'Ikoyi, Lagos', state: 'Lagos State', center: { lat: 6.4549, lng: 3.4346 }, zoom: 16 },
  { label: 'Maitama, Abuja', state: 'FCT Abuja', center: { lat: 9.0820, lng: 7.4983 }, zoom: 16 },
  { label: 'Wuse II, Abuja', state: 'FCT Abuja', center: { lat: 9.0765, lng: 7.4792 }, zoom: 16 },
  { label: 'Sagamu, Ogun', state: 'Ogun State', center: { lat: 6.8485, lng: 3.6463 }, zoom: 15 },
  { label: 'New GRA, PH', state: 'Rivers State', center: { lat: 4.8242, lng: 7.0014 }, zoom: 16 },
  { label: 'Ibadan, Oyo', state: 'Oyo State', center: { lat: 7.5245, lng: 3.9112 }, zoom: 15 },
  { label: 'Enugu GRA', state: 'Enugu State', center: { lat: 6.4584, lng: 7.5464 }, zoom: 15 },
  { label: 'Kano Nassarawa', state: 'Kano State', center: { lat: 11.9964, lng: 8.5364 }, zoom: 15 },
];

export interface PlotPreset {
  id: string;
  label: string;
  widthM: number;
  lengthM: number;
  approxSqm: number;
}

export const NIGERIA_PLOT_PRESETS: PlotPreset[] = [
  { id: 'half-plot', label: 'Half Plot (15×15m)', widthM: 15, lengthM: 15, approxSqm: 225 },
  { id: 'lagos-plot', label: 'Standard Plot (15×30m)', widthM: 15, lengthM: 30, approxSqm: 450 },
  { id: 'classic-plot', label: 'Classic Plot (18×36m)', widthM: 18, lengthM: 36, approxSqm: 648 },
  { id: 'executive-plot', label: 'Executive Plot (30×30m)', widthM: 30, lengthM: 30, approxSqm: 900 },
  { id: 'acre', label: '1 Acre (~64×63m)', widthM: 64, lengthM: 63.23, approxSqm: 4047 },
];

/**
 * Formats decimal lat/lng as Nigerian cadastral style string e.g. "6.4382° N, 3.4721° E"
 */
export function formatCoordinateString(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

/**
 * Parses either "6.4382° N, 3.4721° E" or "6.4382, 3.4721" into LatLngPoint
 */
export function parseCoordinateString(value?: string): LatLngPoint | null {
  if (!value) return null;
  const trimmed = value.trim();

  // Match "lat° N/S, lng° E/W"
  const dirMatch = trimmed.match(
    /(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*,\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?/i,
  );
  if (!dirMatch) return null;

  let lat = parseFloat(dirMatch[1]);
  let lng = parseFloat(dirMatch[3]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  if (dirMatch[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (dirMatch[4]?.toUpperCase() === 'W') lng = -Math.abs(lng);

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Creates a rectangular polygon centered at `center` with exact width & length in meters.
 */
export function createRectangleAroundPoint(
  center: LatLngPoint,
  widthMeters: number,
  lengthMeters: number,
): LatLngPoint[] {
  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.max(111320 * Math.cos((center.lat * Math.PI) / 180), 1);

  const halfLat = lengthMeters / 2 / metersPerDegLat;
  const halfLng = widthMeters / 2 / metersPerDegLng;

  return [
    { lat: center.lat + halfLat, lng: center.lng - halfLng },
    { lat: center.lat + halfLat, lng: center.lng + halfLng },
    { lat: center.lat - halfLat, lng: center.lng + halfLng },
    { lat: center.lat - halfLat, lng: center.lng - halfLng },
  ];
}

/**
 * Computes centroid of a polygon
 */
export function computePolygonCentroid(points: LatLngPoint[]): LatLngPoint | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, pt) => ({ lat: acc.lat + pt.lat, lng: acc.lng + pt.lng }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
}

/**
 * Pure TypeScript fallback spherical polygon area (m^2) when Maps geometry lib is still loading
 */
export function computeSphericalAreaFallback(points: LatLngPoint[]): number {
  if (points.length < 3) return 0;
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const lat1 = (p1.lat * Math.PI) / 180;
    const lat2 = (p2.lat * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    total += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((total * R * R) / 2);
}

/**
 * Pure TypeScript fallback spherical perimeter (m)
 */
export function computePerimeterFallback(points: LatLngPoint[]): number {
  if (points.length < 2) return 0;
  const R = 6371000;
  const dist = (a: LatLngPoint, b: LatLngPoint) => {
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
      sinLat * sinLat +
      Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    if (points.length === 2 && i === 1) break;
    sum += dist(points[i], next);
  }
  return sum;
}

/**
 * Formats square meters into readable Nigerian plot equivalents + hectares
 */
export function formatPlotEquivalents(areaSqm: number): {
  standardPlots648: string;
  lagosPlots450: string;
  hectares: string;
  acres: string;
} {
  return {
    standardPlots648: (areaSqm / 648).toFixed(2),
    lagosPlots450: (areaSqm / 450).toFixed(2),
    hectares: (areaSqm / 10000).toFixed(3),
    acres: (areaSqm / 4046.8564).toFixed(2),
  };
}

/**
 * Parses pasted GeoJSON Polygon/Feature, coordinate array [[lng,lat],...], or line-separated "lat, lng" text
 */
export function parsePolygonInput(raw: string): { points: LatLngPoint[]; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { points: [], error: 'Please paste coordinates or GeoJSON.' };

  // Attempt JSON / GeoJSON parse first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;

      // GeoJSON FeatureCollection / Feature / Polygon
      let ring: unknown = null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (obj.type === 'FeatureCollection' && Array.isArray(obj.features) && obj.features[0]) {
          const geom = (obj.features[0] as Record<string, unknown>).geometry as
            | Record<string, unknown>
            | undefined;
          if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates)) {
            ring = geom.coordinates[0];
          }
        } else if (obj.type === 'Feature' && obj.geometry && typeof obj.geometry === 'object') {
          const geom = obj.geometry as Record<string, unknown>;
          if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
            ring = geom.coordinates[0];
          }
        } else if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
          ring = obj.coordinates[0];
        }
      } else if (Array.isArray(parsed)) {
        // Could be [{lat, lng}, ...] or [[lng, lat], ...] or [[[lng, lat], ...]]
        if (
          Array.isArray(parsed[0]) &&
          Array.isArray((parsed[0] as unknown[])[0])
        ) {
          ring = parsed[0];
        } else {
          ring = parsed;
        }
      }

      if (Array.isArray(ring)) {
        const pts: LatLngPoint[] = [];
        for (const item of ring) {
          if (Array.isArray(item) && item.length >= 2) {
            // GeoJSON is [lng, lat]
            const a = Number(item[0]);
            const b = Number(item[1]);
            if (!Number.isNaN(a) && !Number.isNaN(b)) {
              // Heuristic for Nigeria: lat is ~4..14, lng is ~2..15.
              // Standard GeoJSON is [lng, lat] unless clearly inverted outside Nigeria lat/lng or [lat, lng] in >15
              pts.push({ lat: b, lng: a });
            }
          } else if (item && typeof item === 'object' && 'lat' in item && 'lng' in item) {
            const obj = item as { lat: unknown; lng: unknown };
            const lat = Number(obj.lat);
            const lng = Number(obj.lng);
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              pts.push({ lat, lng });
            }
          }
        }
        // Strip duplicate closing vertex if present
        if (
          pts.length > 3 &&
          Math.abs(pts[0].lat - pts[pts.length - 1].lat) < 1e-7 &&
          Math.abs(pts[0].lng - pts[pts.length - 1].lng) < 1e-7
        ) {
          pts.pop();
        }
        if (pts.length >= 3) return { points: pts };
        return { points: [], error: 'JSON parsed, but fewer than 3 valid polygon coordinates were found.' };
      }
    } catch {
      // Fall through to line-by-line parser
    }
  }

  // Line-by-line or semicolon-separated "lat, lng" pairs
  const lines = trimmed
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const pts: LatLngPoint[] = [];
  for (const line of lines) {
    const pt = parseCoordinateString(line);
    if (pt) pts.push(pt);
  }
  if (
    pts.length > 3 &&
    Math.abs(pts[0].lat - pts[pts.length - 1].lat) < 1e-7 &&
    Math.abs(pts[0].lng - pts[pts.length - 1].lng) < 1e-7
  ) {
    pts.pop();
  }

  if (pts.length < 3) {
    return {
      points: [],
      error:
        'Provide at least 3 vertices (e.g. lines of "6.4382, 3.4721" or a GeoJSON Polygon).',
    };
  }
  return { points: pts };
}

/**
 * Checks whether a point is inside a polygon using ray casting
 */
export function isPointInPolygon(pt: LatLngPoint, polygon: LatLngPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > pt.lat !== yj > pt.lat &&
      pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(a: LatLngPoint, b: LatLngPoint, c: LatLngPoint, d: LatLngPoint): boolean {
  const ccw = (p1: LatLngPoint, p2: LatLngPoint, p3: LatLngPoint) =>
    (p3.lat - p1.lat) * (p2.lng - p1.lng) > (p2.lat - p1.lat) * (p3.lng - p1.lng);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

/**
 * Checks if two polygons overlap (vertex containment or edge intersection)
 */
export function doPolygonsOverlap(polyA: LatLngPoint[], polyB: LatLngPoint[]): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;

  for (const pt of polyA) {
    if (isPointInPolygon(pt, polyB)) return true;
  }
  for (const pt of polyB) {
    if (isPointInPolygon(pt, polyA)) return true;
  }
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/**
 * Exports polygon to GeoJSON string for cadastral records
 */
export function toGeoJsonPolygon(points: LatLngPoint[], name?: string): string {
  const ring = points.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
  if (ring.length > 0) ring.push(ring[0]);
  return JSON.stringify(
    {
      type: 'Feature',
      properties: name ? { name } : {},
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    },
    null,
    2,
  );
}

/**
 * Maps a Google address string or component state name to Anagu's Nigerian state dropdown
 */
export function matchNigerianState(text: string): string | null {
  const normalized = text.toLowerCase();
  const candidates: Array<[string, string]> = [
    ['lagos', 'Lagos State'],
    ['abuja', 'FCT Abuja'],
    ['federal capital territory', 'FCT Abuja'],
    ['fct', 'FCT Abuja'],
    ['ogun', 'Ogun State'],
    ['abeokuta', 'Ogun State'],
    ['rivers', 'Rivers State'],
    ['port harcourt', 'Rivers State'],
    ['oyo', 'Oyo State'],
    ['ibadan', 'Oyo State'],
    ['enugu', 'Enugu State'],
    ['kano', 'Kano State'],
    ['kaduna', 'Kaduna State'],
    ['abia', 'Abia State'],
    ['umuahia', 'Abia State'],
    ['aba', 'Abia State'],
    ['adamawa', 'Adamawa State'],
    ['yola', 'Adamawa State'],
    ['akwa ibom', 'Akwa Ibom State'],
    ['uyo', 'Akwa Ibom State'],
    ['anambra', 'Anambra State'],
    ['awka', 'Anambra State'],
    ['onitsha', 'Anambra State'],
    ['bauchi', 'Bauchi State'],
    ['bayelsa', 'Bayelsa State'],
    ['yenagoa', 'Bayelsa State'],
    ['benue', 'Benue State'],
    ['makurdi', 'Benue State'],
    ['borno', 'Borno State'],
    ['maiduguri', 'Borno State'],
    ['cross river', 'Cross River State'],
    ['calabar', 'Cross River State'],
    ['delta', 'Delta State'],
    ['asaba', 'Delta State'],
    ['warri', 'Delta State'],
    ['ebonyi', 'Ebonyi State'],
    ['abakaliki', 'Ebonyi State'],
    ['edo', 'Edo State'],
    ['benin city', 'Edo State'],
    ['ekiti', 'Ekiti State'],
    ['ado ekiti', 'Ekiti State'],
    ['gombe', 'Gombe State'],
    ['imo', 'Imo State'],
    ['owerri', 'Imo State'],
    ['jigawa', 'Jigawa State'],
    ['dutse', 'Jigawa State'],
    ['katsina', 'Katsina State'],
    ['kebbi', 'Kebbi State'],
    ['birnin kebbi', 'Kebbi State'],
    ['kogi', 'Kogi State'],
    ['lokoja', 'Kogi State'],
    ['kwara', 'Kwara State'],
    ['ilorin', 'Kwara State'],
    ['nasarawa', 'Nasarawa State'],
    ['lafia', 'Nasarawa State'],
    ['niger', 'Niger State'],
    ['minna', 'Niger State'],
    ['ondo', 'Ondo State'],
    ['akure', 'Ondo State'],
    ['osun', 'Osun State'],
    ['osogbo', 'Osun State'],
    ['plateau', 'Plateau State'],
    ['jos', 'Plateau State'],
    ['sokoto', 'Sokoto State'],
    ['taraba', 'Taraba State'],
    ['jalingo', 'Taraba State'],
    ['yobe', 'Yobe State'],
    ['damaturu', 'Yobe State'],
    ['zamfara', 'Zamfara State'],
    ['gusau', 'Zamfara State'],
  ];

  for (const [needle, state] of candidates) {
    const pattern = new RegExp(`\\b${needle.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(normalized)) return state;
  }
  return null;
}

export interface EdgeMeasurement {
  fromIndex: number;
  toIndex: number;
  lengthMeters: number;
  midpoint: LatLngPoint;
}

/**
 * Computes spherical distance (m) between two WGS84 coordinates
 */
export function haversineDistanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Computes edge lengths and midpoints for all polygon edges
 */
export function computeEdgeMeasurements(points: LatLngPoint[]): EdgeMeasurement[] {
  if (points.length < 2) return [];
  const edges: EdgeMeasurement[] = [];
  for (let i = 0; i < points.length; i++) {
    const nextIdx = (i + 1) % points.length;
    if (points.length === 2 && i === 1) break;
    const p1 = points[i];
    const p2 = points[nextIdx];
    edges.push({
      fromIndex: i,
      toIndex: nextIdx,
      lengthMeters: haversineDistanceMeters(p1, p2),
      midpoint: {
        lat: (p1.lat + p2.lat) / 2,
        lng: (p1.lng + p2.lng) / 2,
      },
    });
  }
  return edges;
}

/**
 * Solves 4 corner GPS coordinates [C1(NW), C2(NE), C3(SE), C4(SW)] around `center`
 * given the 4 edge lengths (northM, eastM, southM, westM) and optional clockwise bearing in degrees.
 */
export function computeFourCornerPolygonFromDimensions(
  center: LatLngPoint,
  northM: number,
  eastM: number,
  southM: number,
  westM: number,
  bearingDeg = 0,
): { corners: LatLngPoint[]; error?: string } {
  if (
    !Number.isFinite(northM) ||
    !Number.isFinite(eastM) ||
    !Number.isFinite(southM) ||
    !Number.isFinite(westM) ||
    northM <= 0 ||
    eastM <= 0 ||
    southM <= 0 ||
    westM <= 0
  ) {
    return { corners: [], error: 'All four side dimensions must be positive numbers in meters.' };
  }

  const sum = northM + eastM + southM + westM;
  const maxSide = Math.max(northM, eastM, southM, westM);
  if (maxSide >= sum - maxSide) {
    return {
      corners: [],
      error:
        'These 4 side dimensions cannot form a closed 4-corner plot (one side is >= the other three combined).',
    };
  }

  // Fast exact path for rectangular plots
  if (Math.abs(northM - southM) < 1e-6 && Math.abs(eastM - westM) < 1e-6 && bearingDeg === 0) {
    return {
      corners: createRectangleAroundPoint(center, northM, eastM),
    };
  }

  // Construct C4=(0,0), C3=(southM, 0), and pick diagonal d=|C1-C3| close to right angle at C4
  const dMin = Math.max(Math.abs(westM - southM), Math.abs(northM - eastM)) + 1e-4;
  const dMax = Math.min(westM + southM, northM + eastM) - 1e-4;

  if (dMin >= dMax) {
    return {
      corners: [],
      error: 'Unable to construct a non-degenerate 4-corner polygon from these side lengths.',
    };
  }

  const idealDiag = Math.hypot(southM, westM);
  const d = Math.min(Math.max(idealDiag, dMin), dMax);

  // Angle at C4 in triangle (C1, C4, C3) with sides westM, southM, opposite d
  const cosTheta = Math.min(
    1,
    Math.max(-1, (westM * westM + southM * southM - d * d) / (2 * westM * southM)),
  );
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));

  const c4 = { x: 0, y: 0 };
  const c3 = { x: southM, y: 0 };
  const c1 = { x: westM * cosTheta, y: westM * sinTheta };

  // Find C2 as intersection of circle(C1, northM) and circle(C3, eastM)
  const dx = c3.x - c1.x;
  const dy = c3.y - c1.y;
  const dist13 = Math.hypot(dx, dy);
  const a = (northM * northM - eastM * eastM + dist13 * dist13) / (2 * dist13);
  const hSq = Math.max(0, northM * northM - a * a);
  const h = Math.sqrt(hSq);

  const px = c1.x + (a * dx) / dist13;
  const py = c1.y + (a * dy) / dist13;

  // Choose the outward/upper-right intersection relative to C1->C3
  const optA = { x: px - (h * dy) / dist13, y: py + (h * dx) / dist13 };
  const optB = { x: px + (h * dy) / dist13, y: py - (h * dx) / dist13 };
  const crossA = (c3.x - c1.x) * (optA.y - c1.y) - (c3.y - c1.y) * (optA.x - c1.x);
  const c2 = crossA >= 0 ? optA : optB;

  const localPts = [c1, c2, c3, c4];
  const avgX = localPts.reduce((acc, p) => acc + p.x, 0) / 4;
  const avgY = localPts.reduce((acc, p) => acc + p.y, 0) / 4;

  // Rotate clockwise by bearingDeg
  const rad = (bearingDeg * Math.PI) / 180;
  const cosB = Math.cos(rad);
  const sinB = Math.sin(rad);

  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.max(111320 * Math.cos((center.lat * Math.PI) / 180), 1);

  const corners: LatLngPoint[] = localPts.map((pt) => {
    const cx = pt.x - avgX;
    const cy = pt.y - avgY;
    const rotEast = cx * cosB + cy * sinB;
    const rotNorth = -cx * sinB + cy * cosB;
    return {
      lat: center.lat + rotNorth / metersPerDegLat,
      lng: center.lng + rotEast / metersPerDegLng,
    };
  });

  return { corners };
}
