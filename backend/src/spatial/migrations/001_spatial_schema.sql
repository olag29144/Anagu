-- =============================================================================
-- Migration 001: Spatial schema
-- =============================================================================
--
-- PREREQUISITE — PostGIS must be enabled in Supabase Dashboard:
--   Database → Extensions → postgis → Enable
--
-- Run this FIRST, before migrations 002–006.
-- =============================================================================

-- Supabase installs PostGIS into the "extensions" schema.
-- Setting search_path here makes the geometry type and ST_* functions
-- visible for the duration of this session.
SET search_path = public, extensions;

-- parcels table
CREATE TABLE IF NOT EXISTS parcels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID,
  token_id        TEXT,
  geom            extensions.geometry(Polygon, 4326) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'registered', 'reverted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parcels_geom_idx ON parcels USING GIST (geom);

-- RPC: check_geometry_valid
-- Returns: { "is_valid": boolean }
CREATE OR REPLACE FUNCTION check_geometry_valid(wkt text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT json_build_object(
    'is_valid', extensions.ST_IsValid(extensions.ST_GeomFromEWKT(wkt))
  );
$$;

-- RPC: check_parcel_overlap
-- Returns: { "overlaps": boolean, "conflicting_parcel_id": text | null }
CREATE OR REPLACE FUNCTION check_parcel_overlap(
  wkt                     text,
  buffer_metres           float,
  exclude_application_id  uuid
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT json_build_object(
    'overlaps',               COUNT(*) > 0,
    'conflicting_parcel_id',  MIN(p.id)::text
  )
  FROM parcels p
  WHERE extensions.ST_Intersects(
    extensions.ST_Buffer(
      extensions.ST_GeomFromEWKT(wkt)::extensions.geography,
      buffer_metres
    )::extensions.geometry,
    p.geom
  )
  AND (
    exclude_application_id IS NULL
    OR p.application_id != exclude_application_id
  )
  AND p.status = 'registered';
$$;
