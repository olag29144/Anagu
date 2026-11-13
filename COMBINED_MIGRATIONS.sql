-- =============================================================================
-- ANAGU COMBINED MIGRATIONS — Run this entire file in Supabase SQL Editor
-- =============================================================================
--
-- This file automatically enables PostGIS and creates all tables
-- Paste this entire file into the SQL Editor and click Run
-- =============================================================================
-- =============================================================================
-- Migration 001: Spatial schema (FIXED for Supabase)
-- =============================================================================
--
-- This version automatically enables PostGIS if not already enabled
-- =============================================================================

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- Set search_path so geometry type and ST_* functions are visible
SET search_path = public, extensions;

-- parcels table
CREATE TABLE IF NOT EXISTS parcels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID,
  token_id        TEXT,
  geom            geometry(Polygon, 4326) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'registered', 'reverted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parcels_geom_idx ON parcels USING GIST (geom);
CREATE UNIQUE INDEX IF NOT EXISTS parcels_application_id_idx
  ON parcels (application_id)
  WHERE application_id IS NOT NULL;

-- RPC: check_geometry_valid
CREATE OR REPLACE FUNCTION check_geometry_valid(wkt text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT json_build_object(
    'is_valid', ST_IsValid(ST_GeomFromEWKT(wkt))
  );
$$;

-- RPC: persist_verified_parcel
CREATE OR REPLACE FUNCTION persist_verified_parcel(
  p_application_id uuid,
  p_wkt             text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  parcel_id uuid;
BEGIN
  INSERT INTO parcels (application_id, geom, status)
  VALUES (
    p_application_id,
    ST_GeomFromEWKT(p_wkt)::geometry(Polygon, 4326),
    'pending'
  )
  ON CONFLICT (application_id) WHERE application_id IS NOT NULL
  DO UPDATE SET geom = EXCLUDED.geom
  RETURNING id INTO parcel_id;

  RETURN parcel_id;
END;
$$;

REVOKE ALL ON FUNCTION persist_verified_parcel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION persist_verified_parcel(uuid, text) TO service_role;

-- RPC: check_parcel_overlap
-- Fixed: Cast UUID to text before using MIN()
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
    'conflicting_parcel_id',  MIN(p.id::text)
  )
  FROM parcels p
  WHERE ST_Intersects(
    ST_Buffer(
      ST_GeomFromEWKT(wkt)::geography,
      buffer_metres
    )::geometry,
    p.geom
  )
  AND (
    exclude_application_id IS NULL
    OR p.application_id != exclude_application_id
  )
  AND p.status = 'registered';
$$;

-- =============================================================================
-- 002: Audit trail
-- =============================================================================
-- Migration 002: Audit trail (append-only, immutable)
-- Apply via Supabase SQL editor or CLI (see README.md in this directory)
-- Satisfies Requirements 8.1, 8.2, 8.3, 8.5

CREATE TABLE IF NOT EXISTS audit_trail (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   TEXT NOT NULL,
  actor_id    UUID,
  action      TEXT NOT NULL,
  outcome     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_trail' AND policyname='audit_insert') THEN
    CREATE POLICY audit_insert ON audit_trail
      FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_trail' AND policyname='audit_no_update') THEN
    CREATE POLICY audit_no_update ON audit_trail
      FOR UPDATE USING (false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_trail' AND policyname='audit_no_delete') THEN
    CREATE POLICY audit_no_delete ON audit_trail
      FOR DELETE USING (false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_trail' AND policyname='audit_select') THEN
    CREATE POLICY audit_select ON audit_trail
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END;
$$;

-- RLS is bypassed by service_role, so enforce immutability at the table level too.
CREATE OR REPLACE FUNCTION public.reject_audit_trail_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_trail is append-only; % is not permitted', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS audit_trail_reject_mutation ON public.audit_trail;
CREATE TRIGGER audit_trail_reject_mutation
  BEFORE UPDATE OR DELETE ON public.audit_trail
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_audit_trail_mutation();


-- =============================================================================
-- 003: Applications
-- =============================================================================
-- Migration 003: Applications table
-- Apply via Supabase SQL editor or CLI (see README.md in this directory)
-- Depends on: 001_spatial_schema.sql (parcels table must exist for the FK added below)

CREATE TABLE IF NOT EXISTS applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id            UUID NOT NULL,
  owner_name            TEXT NOT NULL,
  owner_wallet_address  TEXT NOT NULL,
  document_number       TEXT NOT NULL,
  document_type         TEXT NOT NULL,
  issuing_authority     TEXT NOT NULL,
  parcel_ref            TEXT NOT NULL,
  parcel_ring           JSONB,
  spatial_hash          TEXT,
  title_metadata_uri    TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'completed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from parcels.application_id â†’ applications.id
-- Uses DO $$ block so it is idempotent (safe to run more than once)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_parcels_application'
      AND table_name = 'parcels'
  ) THEN
    ALTER TABLE parcels
      ADD CONSTRAINT fk_parcels_application
      FOREIGN KEY (application_id)
      REFERENCES applications(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;


-- =============================================================================
-- 004: Land titles
-- =============================================================================
-- Migration 004: Land titles
-- Apply via Supabase SQL editor or CLI (see README.md in this directory)
-- Depends on: 001_spatial_schema.sql (parcels), 003_applications.sql (applications)

CREATE TABLE IF NOT EXISTS land_titles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id),
  token_id        TEXT NOT NULL UNIQUE,
  owner_id        UUID NOT NULL,
  parcel_id       UUID NOT NULL REFERENCES parcels(id),
  tx_hash         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'revoked')),
  issued_at       TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ
);


-- =============================================================================
-- 005: MQTT events
-- =============================================================================
-- mqtt_events â€” system monitoring log for every MQTT publish event
CREATE TABLE IF NOT EXISTS mqtt_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic        TEXT    NOT NULL,
  payload_size INTEGER NOT NULL,        -- byte length of the serialised JSON payload
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 006: User roles
-- =============================================================================
-- Migration 006: User roles table
-- Apply via Supabase SQL editor or CLI (see README.md in this directory)
-- No external dependencies (user_id references Supabase auth.users by convention, not FK)

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID PRIMARY KEY,
  role       TEXT NOT NULL
             CHECK (role IN ('citizen', 'surveyor', 'registrar', 'land_admin', 'governor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own role" ON user_roles;
CREATE POLICY "Users can read their own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


-- =============================================================================
-- ALL MIGRATIONS COMPLETE - All tables and functions created successfully
-- =============================================================================
