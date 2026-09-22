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
