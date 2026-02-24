-- Add baseline count columns to claimed_buildings for landlord alert change detection
ALTER TABLE claimed_buildings
  ADD COLUMN last_violation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_complaint_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_checked_at timestamptz;
