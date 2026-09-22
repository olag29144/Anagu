import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { AuditService } from '../audit/audit.service';
import {
  CoordinateRing,
  SpatialVerificationDto,
  SpatialVerificationResult,
} from './dto/spatial-verification.dto';

/** Row shape returned by the `check_geometry_valid` Postgres RPC. */
interface GeometryValidRow {
  is_valid: boolean;
}

/** Row shape returned by the `check_parcel_overlap` Postgres RPC. */
interface ParcelOverlapRow {
  overlaps: boolean;
  conflicting_parcel_id: string | null;
}

/**
 * GIS-based spatial verification service.
 *
 * Implements the two-stage PostGIS check described in Requirement 2:
 *   Stage 1 — `ST_IsValid()` geometry validation (Req 2.2)
 *   Stage 2 — `ST_Intersects()` overlap detection with 0.5 m buffer (Req 2.3)
 *
 * Every code path records an audit entry before returning (Req 2.8).
 */
@Injectable()
export class SpatialService {
  private readonly logger = new Logger(SpatialService.name);

  /**
   * Overlap tolerance in metres — exactly 0.5 as required by Req 2.7.
   * Exposed as a `readonly` constant so it appears in API docs and test reports.
   */
  readonly OVERLAP_BUFFER_METRES = 0.5 as const;

  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Run the two-stage spatial verification for the given parcel ring.
   *
   * @param dto - Application ID and the submitted parcel coordinate ring.
   * @returns A `SpatialVerificationResult` with outcome, optional diagnostic code,
   *          optional conflicting parcel ID, the fixed buffer value, and a timestamp.
   */
  async verifySpatial(dto: SpatialVerificationDto): Promise<SpatialVerificationResult> {
    const checkedAt = new Date().toISOString();
    const wkt = this.ringToWKT(dto.parcelRing);

    // ------------------------------------------------------------------
    // Stage 1 — Geometry validity (Req 2.2, 2.5)
    // ------------------------------------------------------------------
    const { data: validRow, error: validError } = await this.supabase.rpc(
      'check_geometry_valid',
      { wkt },
    );

    if (validError) {
      this.logger.error(
        `check_geometry_valid RPC error for application ${dto.applicationId}: ${validError.message}`,
      );
      throw new Error(`Spatial geometry check failed: ${validError.message}`);
    }

    const geometryRow = validRow as GeometryValidRow | null;

    if (!geometryRow?.is_valid) {
      const result: SpatialVerificationResult = {
        outcome: 'rejected_invalid_geometry',
        diagnosticCode: 'GEOM_INVALID',
        bufferMetres: 0.5,
        checkedAt,
      };

      await this.auditService.record({
        entityId: dto.applicationId,
        action: 'SPATIAL_VERIFICATION',
        outcome: 'REJECTED_INVALID_GEOMETRY',
        metadata: { wkt },
      });

      return result;
    }

    // ------------------------------------------------------------------
    // Stage 2 — Overlap detection with 0.5 m buffer (Req 2.3, 2.6)
    // ------------------------------------------------------------------
    const { data: overlapRow, error: overlapError } = await this.supabase.rpc(
      'check_parcel_overlap',
      {
        wkt,
        buffer_metres: this.OVERLAP_BUFFER_METRES,
        exclude_application_id: dto.applicationId,
      },
    );

    if (overlapError) {
      this.logger.error(
        `check_parcel_overlap RPC error for application ${dto.applicationId}: ${overlapError.message}`,
      );
      throw new Error(`Spatial overlap check failed: ${overlapError.message}`);
    }

    const parcelOverlapRow = overlapRow as ParcelOverlapRow | null;

    if (parcelOverlapRow?.overlaps) {
      const conflictingId = parcelOverlapRow.conflicting_parcel_id ?? undefined;
      const result: SpatialVerificationResult = {
        outcome: 'rejected_overlap',
        diagnosticCode: 'PARCEL_OVERLAP',
        ...(conflictingId !== undefined && { conflictingParcelId: conflictingId }),
        bufferMetres: 0.5,
        checkedAt,
      };

      await this.auditService.record({
        entityId: dto.applicationId,
        action: 'SPATIAL_VERIFICATION',
        outcome: 'REJECTED_OVERLAP',
        metadata: {
          conflictingParcelId: parcelOverlapRow.conflicting_parcel_id,
          bufferMetres: this.OVERLAP_BUFFER_METRES,
        },
      });

      return result;
    }

    // ------------------------------------------------------------------
    // Approved (Req 2.4)
    // ------------------------------------------------------------------
    const result: SpatialVerificationResult = {
      outcome: 'approved',
      bufferMetres: 0.5,
      checkedAt,
    };

    await this.auditService.record({
      entityId: dto.applicationId,
      action: 'SPATIAL_VERIFICATION',
      outcome: 'APPROVED',
      metadata: { bufferMetres: this.OVERLAP_BUFFER_METRES },
    });

    return result;
  }

  /**
   * Convert a `CoordinateRing` to an EWKT POLYGON string.
   *
   * Requirement 2.1 — parcel must be WGS 84 (SRID=4326).
   * The ring is automatically closed if the first and last points differ.
   *
   * @example
   * ringToWKT({ coordinates: [[3.0, 6.0], [4.0, 6.0], [4.0, 7.0], [3.0, 7.0]] })
   * // → "SRID=4326;POLYGON((3 6, 4 6, 4 7, 3 7, 3 6))"
   */
  private ringToWKT(ring: CoordinateRing): string {
    const coords = ring.coordinates;

    // Close the ring if needed (first point !== last point)
    const closed =
      coords.length > 0 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
        ? coords
        : [...coords, coords[0]];

    const pointList = closed.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
    return `SRID=4326;POLYGON((${pointList}))`;
  }
}
