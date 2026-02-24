-- Add baseline count columns to address_watch for detecting new records
ALTER TABLE address_watch
  ADD COLUMN last_violation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_complaint_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_checked_at timestamptz;
