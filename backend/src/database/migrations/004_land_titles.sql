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
