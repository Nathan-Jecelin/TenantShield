-- Add user_id column to reviews (nullable for existing seed data)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Index for account page queries
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- Drop old permissive insert policy on reviews
DROP POLICY IF EXISTS "Anyone can insert reviews" ON reviews;

-- Only authenticated users can insert reviews, tied to their own user_id
CREATE POLICY "Authenticated users can insert own reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update landlord score update policy to require authenticated role
DROP POLICY IF EXISTS "Anyone can update landlord scores" ON landlords;

CREATE POLICY "Authenticated users can update landlord scores"
  ON landlords FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read all reviews (existing select policy likely covers this,
-- but ensure it exists)
DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;

CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  USING (true);
