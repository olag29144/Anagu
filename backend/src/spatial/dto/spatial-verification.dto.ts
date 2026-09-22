/**
 * DTOs for the GIS-based spatial verification workflow.
 * Requirement 2.1 — coordinates must be WGS 84 (EPSG:4326).
 */

/** A closed ring of [longitude, latitude] pairs forming a polygon boundary. */
export interface CoordinateRing {
  /** Each tuple is [longitude, latitude] in WGS 84 decimal degrees. */
  coordinates: [number, number][];
}

/** Input to the spatial verification service. */
export interface SpatialVerificationDto {
  /** UUID of the land-registration application being verified. */
  applicationId: string;
  /** The outer ring of the submitted parcel polygon. */
  parcelRing: CoordinateRing;
}

/**
 * The three possible outcomes returned by the Spatial Verifier.
 * Requirement 2.4 — approved, 2.5 — invalid geometry, 2.6 — overlap.
 */
export type SpatialOutcome =
  | 'approved'
  | 'rejected_invalid_geometry'
  | 'rejected_overlap';

/**
 * Machine-readable diagnostic codes included with rejection results.
 * Requirement 2.5 / 2.6.
 */
export type DiagnosticCode = 'GEOM_INVALID' | 'PARCEL_OVERLAP';

/**
 * The result returned by `SpatialService.verifySpatial()`.
 * Requirement 2.4–2.8.
 */
export interface SpatialVerificationResult {
  /** Approval or rejection outcome. */
  outcome: SpatialOutcome;
  /** Present only on rejection; identifies the failure mode. */
  diagnosticCode?: DiagnosticCode;
  /** UUID of the conflicting registered parcel; present only on PARCEL_OVERLAP. */
  conflictingParcelId?: string;
  /**
   * The overlap tolerance buffer used in metres.
   * Requirement 2.7 — value is always exactly 0.5.
   */
  bufferMetres: 0.5;
  /** ISO 8601 timestamp of when the check was executed. */
  checkedAt: string;
}
