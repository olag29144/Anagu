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
