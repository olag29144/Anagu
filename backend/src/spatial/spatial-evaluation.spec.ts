import { Test, TestingModule } from '@nestjs/testing';
import { SpatialService } from './spatial.service';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { AuditService } from '../audit/audit.service';
import { CoordinateRing } from './dto/spatial-verification.dto';

interface RegisteredParcel {
  id: string;
  applicationId: string;
  coords: [number, number][];
}

interface Pt {
  x: number;
  y: number;
}

const REF_LAT = 9.05;
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG = 111_320 * Math.cos((REF_LAT * Math.PI) / 180);

function toMetres([lng, lat]: [number, number]): Pt {
  return { x: lng * M_PER_DEG_LNG, y: lat * M_PER_DEG_LAT };
}

function parseWktPolygon(wkt: string): [number, number][] {
  const match = wkt.match(/POLYGON\(\((.*)\)\)/i);
  if (!match || !match[1].trim()) return [];
  return match[1].split(',').map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return [lng, lat];
  });
}

function cross(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(p: Pt, q: Pt, r: Pt): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + 1e-12 &&
    q.x >= Math.min(p.x, r.x) - 1e-12 &&
    q.y <= Math.max(p.y, r.y) + 1e-12 &&
    q.y >= Math.min(p.y, r.y) - 1e-12
  );
}

function segmentsIntersect(p1: Pt, q1: Pt, p2: Pt, q2: Pt): boolean {
  const d1 = cross(p2, q2, p1);
  const d2 = cross(p2, q2, q1);
  const d3 = cross(p1, q1, p2);
  const d4 = cross(p1, q1, q2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (Math.abs(d1) < 1e-9 && onSegment(p2, p1, q2)) return true;
  if (Math.abs(d2) < 1e-9 && onSegment(p2, q1, q2)) return true;
  if (Math.abs(d3) < 1e-9 && onSegment(p1, p2, q1)) return true;
  if (Math.abs(d4) < 1e-9 && onSegment(p1, q2, q1)) return true;
  return false;
}

function pointToSegmentDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function segmentDistance(a1: Pt, b1: Pt, a2: Pt, b2: Pt): number {
  if (segmentsIntersect(a1, b1, a2, b2)) return 0;
  return Math.min(
    pointToSegmentDist(a1, a2, b2),
    pointToSegmentDist(b1, a2, b2),
    pointToSegmentDist(a2, a1, b1),
    pointToSegmentDist(b2, a1, b1),
  );
}

function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonArea(poly: Pt[]): number {
  let area = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    area += poly[i].x * poly[i + 1].y - poly[i + 1].x * poly[i].y;
  }
  return Math.abs(area) / 2;
}

function isGeometryValidWkt(wkt: string): boolean {
  const coords = parseWktPolygon(wkt);
  if (coords.length < 4) return false;
  const pts = coords.map(toMetres);
  if (polygonArea(pts) < 1e-6) return false;

  const edgeCount = pts.length - 1;
  for (let i = 0; i < edgeCount; i++) {
    const a1 = pts[i];
    const b1 = pts[i + 1];
    if (Math.hypot(b1.x - a1.x, b1.y - a1.y) < 1e-9) return false;

    for (let j = i + 2; j < edgeCount; j++) {
      if (i === 0 && j === edgeCount - 1) continue;
      if (segmentsIntersect(a1, b1, pts[j], pts[j + 1])) return false;
    }
  }
  return true;
}

function polygonsWithinBuffer(coordsA: [number, number][], coordsB: [number, number][], bufferMetres: number): boolean {
  const polyA = coordsA.map(toMetres);
  const polyB = coordsB.map(toMetres);

  if (polyA.some((p) => pointInPolygon(p, polyB)) || polyB.some((p) => pointInPolygon(p, polyA))) {
    return true;
  }

  for (let i = 0; i < polyA.length - 1; i++) {
    for (let j = 0; j < polyB.length - 1; j++) {
      if (segmentDistance(polyA[i], polyA[i + 1], polyB[j], polyB[j + 1]) <= bufferMetres) {
        return true;
      }
    }
  }
  return false;
}

function offsetMetres(lng: number, lat: number, dxMetres: number, dyMetres: number): [number, number] {
  return [lng + dxMetres / M_PER_DEG_LNG, lat + dyMetres / M_PER_DEG_LAT];
}

function makeRect(baseLng: number, baseLat: number, widthM: number, heightM: number): CoordinateRing {
  return {
    coordinates: [
      offsetMetres(baseLng, baseLat, 0, 0),
      offsetMetres(baseLng, baseLat, widthM, 0),
      offsetMetres(baseLng, baseLat, widthM, heightM),
      offsetMetres(baseLng, baseLat, 0, heightM),
    ],
  };
}

describe('Component 1 — GIS Spatial Verification Evaluation (Run A & Run B)', () => {
  let service: SpatialService;
  let existingParcels: RegisteredParcel[];

  beforeEach(async () => {
    existingParcels = [];

    const supabaseMock = {
      rpc: jest.fn(async (fn: string, params: Record<string, unknown>) => {
        if (fn === 'check_geometry_valid') {
          return {
            data: { is_valid: isGeometryValidWkt(params.wkt as string) },
            error: null,
          };
        }

        if (fn === 'check_parcel_overlap') {
          const candidateCoords = parseWktPolygon(params.wkt as string);
          const bufferMetres = Number(params.buffer_metres);
          const excludeAppId = params.exclude_application_id as string;

          const conflict = existingParcels.find(
            (p) => p.applicationId !== excludeAppId && polygonsWithinBuffer(candidateCoords, p.coords, bufferMetres),
          );

          return {
            data: {
              overlaps: Boolean(conflict),
              conflicting_parcel_id: conflict?.id ?? null,
            },
            error: null,
          };
        }

        if (fn === 'persist_verified_parcel') {
          const id = `parcel-${existingParcels.length + 1}`;
          existingParcels.push({
            id,
            applicationId: params.p_application_id as string,
            coords: parseWktPolygon(params.p_wkt as string),
          });
          return { data: id, error: null };
        }

        throw new Error(`Unexpected RPC: ${fn}`);
      }),
    };

    const auditMock = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpatialService,
        { provide: SupabaseClientService, useValue: supabaseMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<SpatialService>(SpatialService);
  });

  async function runBatch(
    label: string,
    cases: Array<{
      applicationId: string;
      parcelRing: CoordinateRing;
      expected: 'approved' | 'rejected_invalid_geometry' | 'rejected_overlap';
    }>,
  ) {
    const counts = {
      approved: 0,
      rejected_invalid_geometry: 0,
      rejected_overlap: 0,
    };

    for (const testCase of cases) {
      const result = await service.verifySpatial({
        applicationId: testCase.applicationId,
        parcelRing: testCase.parcelRing,
      });

      expect(result.bufferMetres).toBe(0.5);
      expect(result.outcome).toBe(testCase.expected);

      counts[result.outcome] += 1;

      if (result.outcome === 'approved') {
        await service.persistVerifiedParcel(testCase.applicationId, testCase.parcelRing);
      }
    }

    const total = cases.length;
    const summary = [
      {
        Outcome: 'Valid and non-overlapping',
        Frequency: counts.approved,
        Percentage: `${((counts.approved / total) * 100).toFixed(1)}%`,
      },
      {
        Outcome: 'Invalid geometry',
        Frequency: counts.rejected_invalid_geometry,
        Percentage: `${((counts.rejected_invalid_geometry / total) * 100).toFixed(1)}%`,
      },
      {
        Outcome: 'Overlapping existing parcel',
        Frequency: counts.rejected_overlap,
        Percentage: `${((counts.rejected_overlap / total) * 100).toFixed(1)}%`,
      },
      {
        Outcome: 'Total',
        Frequency: total,
        Percentage: '100.0%',
      },
    ];

    console.info(`\n[Spatial Verification — ${label}] (Overlap tolerance: ${service.OVERLAP_BUFFER_METRES} m)`);
    console.table(summary);

    return { counts, total };
  }

  it('Run A (Clean / Controlled Test Set) produces 100% classification accuracy', async () => {
    const cases: Array<{
      applicationId: string;
      parcelRing: CoordinateRing;
      expected: 'approved' | 'rejected_invalid_geometry' | 'rejected_overlap';
    }> = [];

    // 14 valid non-overlapping 20m x 20m parcels spaced 30m apart
    for (let i = 0; i < 14; i++) {
      cases.push({
        applicationId: `clean-valid-${i}`,
        parcelRing: makeRect(7.49 + i * 0.001, 9.05, 20, 20),
        expected: 'approved',
      });
    }

    // 3 invalid geometries (self-intersecting bowtie, < 3 coords, colinear zero-area)
    cases.push(
      {
        applicationId: 'clean-invalid-bowtie',
        parcelRing: {
          coordinates: [
            offsetMetres(7.52, 9.05, 0, 0),
            offsetMetres(7.52, 9.05, 20, 20),
            offsetMetres(7.52, 9.05, 20, 0),
            offsetMetres(7.52, 9.05, 0, 20),
          ],
        },
        expected: 'rejected_invalid_geometry',
      },
      {
        applicationId: 'clean-invalid-short',
        parcelRing: { coordinates: [[7.52, 9.05], [7.521, 9.05]] },
        expected: 'rejected_invalid_geometry',
      },
      {
        applicationId: 'clean-invalid-zero-area',
        parcelRing: {
          coordinates: [
            offsetMetres(7.52, 9.05, 0, 0),
            offsetMetres(7.52, 9.05, 10, 0),
            offsetMetres(7.52, 9.05, 20, 0),
          ],
        },
        expected: 'rejected_invalid_geometry',
      },
    );

    // 3 overlapping parcels directly intersecting clean-valid-0..2
    for (let i = 0; i < 3; i++) {
      cases.push({
        applicationId: `clean-overlap-${i}`,
        parcelRing: makeRect(7.49 + i * 0.001, 9.05, 10, 10),
        expected: 'rejected_overlap',
      });
    }

    const { counts, total } = await runBatch('Run A (Clean Controlled)', cases);
    expect(total).toBe(20);
    expect(counts.approved).toBe(14);
    expect(counts.rejected_invalid_geometry).toBe(3);
    expect(counts.rejected_overlap).toBe(3);
  });

  it('Run B (Deliberately Messy Boundary Set: near-miss <= 0.5m, > 0.5m, slivers, rotated overlaps)', async () => {
    const baseLng = 7.45;
    const baseLat = 9.06;

    const cases: Array<{
      applicationId: string;
      parcelRing: CoordinateRing;
      expected: 'approved' | 'rejected_invalid_geometry' | 'rejected_overlap';
    }> = [
      // Seed parcel 0 at [0..20, 0..20]
      {
        applicationId: 'messy-seed-0',
        parcelRing: makeRect(baseLng, baseLat, 20, 20),
        expected: 'approved',
      },
      // Parcel separated by 0.80m (> 0.5m buffer) -> MUST be approved
      {
        applicationId: 'messy-gap-0.80m',
        parcelRing: makeRect(baseLng, baseLat + 20.8 / M_PER_DEG_LAT, 20, 20),
        expected: 'approved',
      },
      // Parcel separated by 0.55m (> 0.5m buffer) -> MUST be approved
      {
        applicationId: 'messy-gap-0.55m',
        parcelRing: makeRect(baseLng, baseLat + 41.35 / M_PER_DEG_LAT, 20, 20),
        expected: 'approved',
      },
      // Separate parcel shifted east by 50m
      {
        applicationId: 'messy-seed-1',
        parcelRing: makeRect(baseLng + 50 / M_PER_DEG_LNG, baseLat, 20, 20),
        expected: 'approved',
      },
      // Near-miss gap 0.30m (<= 0.5m buffer) from seed-0 -> MUST be rejected_overlap
      {
        applicationId: 'messy-nearmiss-0.30m',
        parcelRing: {
          coordinates: [
            offsetMetres(baseLng, baseLat, 20.3, 0),
            offsetMetres(baseLng, baseLat, 40.3, 0),
            offsetMetres(baseLng, baseLat, 40.3, 20),
            offsetMetres(baseLng, baseLat, 20.3, 20),
          ],
        },
        expected: 'rejected_overlap',
      },
      // Narrow sliver crossing seed-0 eastern edge by 0.2m
      {
        applicationId: 'messy-sliver-overlap',
        parcelRing: {
          coordinates: [
            offsetMetres(baseLng, baseLat, 19.8, 2),
            offsetMetres(baseLng, baseLat, 25, 2),
            offsetMetres(baseLng, baseLat, 25, 4),
            offsetMetres(baseLng, baseLat, 19.8, 4),
          ],
        },
        expected: 'rejected_overlap',
      },
      // Slightly rotated polygon intruding into seed-1 corner
      {
        applicationId: 'messy-rotated-overlap',
        parcelRing: {
          coordinates: [
            offsetMetres(baseLng + 50 / M_PER_DEG_LNG, baseLat, 19.7, 10),
            offsetMetres(baseLng + 50 / M_PER_DEG_LNG, baseLat, 35, 12),
            offsetMetres(baseLng + 50 / M_PER_DEG_LNG, baseLat, 33, 25),
            offsetMetres(baseLng + 50 / M_PER_DEG_LNG, baseLat, 18, 22),
          ],
        },
        expected: 'rejected_overlap',
      },
      // Figure-8 self-intersecting ring
      {
        applicationId: 'messy-figure8-invalid',
        parcelRing: {
          coordinates: [
            offsetMetres(baseLng, baseLat, 100, 0),
            offsetMetres(baseLng, baseLat, 115, 15),
            offsetMetres(baseLng, baseLat, 100, 15),
            offsetMetres(baseLng, baseLat, 115, 0),
          ],
        },
        expected: 'rejected_invalid_geometry',
      },
      // Consecutive duplicate vertex causing invalid/degenerate ring
      {
        applicationId: 'messy-duplicate-vertex',
        parcelRing: {
          coordinates: [
            offsetMetres(baseLng, baseLat, 120, 0),
            offsetMetres(baseLng, baseLat, 120, 0),
            offsetMetres(baseLng, baseLat, 130, 0),
            offsetMetres(baseLng, baseLat, 130, 10),
          ],
        },
        expected: 'rejected_invalid_geometry',
      },
      // Out-of-bounds WGS84 coordinate
      {
        applicationId: 'messy-out-of-range',
        parcelRing: {
          coordinates: [
            [185.0, 9.05],
            [185.01, 9.05],
            [185.01, 9.06],
          ],
        },
        expected: 'rejected_invalid_geometry',
      },
    ];

    const { counts, total } = await runBatch('Run B (Messy Boundary Cases)', cases);
    expect(total).toBe(10);
    expect(counts.approved).toBe(4);
    expect(counts.rejected_overlap).toBe(3);
    expect(counts.rejected_invalid_geometry).toBe(3);
  });
});
