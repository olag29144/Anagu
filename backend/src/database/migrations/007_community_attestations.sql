-- Migration 007: Community ownership attestations
-- Backend service-role access only; no client policies are intentionally defined.

CREATE TABLE IF NOT EXISTS community_attestations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_ref    TEXT NOT NULL,
  attestation   TEXT NOT NULL CHECK (length(btrim(attestation)) > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_attestations_parcel_ref
  ON community_attestations (parcel_ref);

ALTER TABLE community_attestations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE community_attestations TO service_role;
