-- Expand plan column to support new tiers: free, professional, portfolio, enterprise
-- Also keep 'pro' as valid for legacy rows (will be treated as 'professional' in app code)
ALTER TABLE landlord_profiles
  DROP CONSTRAINT IF EXISTS landlord_profiles_plan_check;

ALTER TABLE landlord_profiles
  ADD CONSTRAINT landlord_profiles_plan_check
  CHECK (plan IN ('free', 'pro', 'professional', 'portfolio', 'enterprise'));

-- Migrate existing 'pro' users to 'professional'
UPDATE landlord_profiles SET plan = 'professional' WHERE plan = 'pro';
