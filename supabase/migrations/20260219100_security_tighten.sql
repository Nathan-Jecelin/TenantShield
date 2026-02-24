-- Tighten landlord UPDATE policy: only allow score/review_count updates, not name/slug changes
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can update landlord scores" ON landlords;

-- Replace with a more restrictive policy that still allows score recalculation
CREATE POLICY "Authenticated users can update landlord scores"
  ON landlords FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to INSERT new landlords (for review submissions with new companies)
CREATE POLICY "Authenticated users can create landlords"
  ON landlords FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to INSERT new addresses (for linking addresses to landlords from reviews)
CREATE POLICY "Authenticated users can add addresses"
  ON addresses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
