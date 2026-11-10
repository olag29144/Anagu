-- Migration 008: Distinguish legal holds from ordinary pending applications.

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('pending', 'legal_pending', 'in_review', 'approved', 'rejected', 'completed'));