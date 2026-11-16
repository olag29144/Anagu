-- Migration 009: Support applicant-initiated cancellation ('cancelled') in applications status.

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN ('pending', 'legal_pending', 'in_review', 'approved', 'rejected', 'cancelled', 'completed'));
