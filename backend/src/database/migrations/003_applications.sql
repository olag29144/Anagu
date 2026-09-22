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

-- Add FK from parcels.application_id → applications.id
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
