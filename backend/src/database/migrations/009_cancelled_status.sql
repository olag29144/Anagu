-- Add 'cancelled' to ApplicationStatus enum
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check 
  CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'completed', 'cancelled'));
