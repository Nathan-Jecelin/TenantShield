-- Add UPDATE policy and updated_at column to landlord_responses

-- Add updated_at column for tracking edits
ALTER TABLE landlord_responses
  ADD COLUMN updated_at timestamptz;

-- Allow landlords to update their own responses
CREATE POLICY "Landlords can update own responses"
  ON landlord_responses FOR UPDATE
  TO authenticated
  USING (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()))
  WITH CHECK (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()));
