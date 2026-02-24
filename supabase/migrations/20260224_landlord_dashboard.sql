-- Landlord Dashboard: tables, indexes, and RLS policies

-- ============================================================
-- 1. landlord_profiles
-- ============================================================
CREATE TABLE landlord_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  contact_email text,
  phone text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro')),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_landlord_profiles_user_id ON landlord_profiles (user_id);

ALTER TABLE landlord_profiles ENABLE ROW LEVEL SECURITY;

-- Own profile: select
CREATE POLICY "Landlords can view own profile"
  ON landlord_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Own profile: insert
CREATE POLICY "Landlords can create own profile"
  ON landlord_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Own profile: update
CREATE POLICY "Landlords can update own profile"
  ON landlord_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin: select
CREATE POLICY "Admin can view all landlord profiles"
  ON landlord_profiles FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'njecelin17@gmail.com');

-- Admin: update
CREATE POLICY "Admin can update all landlord profiles"
  ON landlord_profiles FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'njecelin17@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'njecelin17@gmail.com');

-- Service role: full access
CREATE POLICY "Service role full access landlord_profiles"
  ON landlord_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. claimed_buildings
-- ============================================================
CREATE TABLE claimed_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlord_profiles(id) ON DELETE CASCADE,
  address text NOT NULL,
  latitude double precision,
  longitude double precision,
  neighborhood text,
  units integer,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  verified boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verification_notes text,
  claimant_role text NOT NULL DEFAULT 'owner' CHECK (claimant_role IN ('owner', 'property_manager', 'management_company'))
);

CREATE INDEX idx_claimed_buildings_landlord_id ON claimed_buildings (landlord_id);
CREATE INDEX idx_claimed_buildings_address ON claimed_buildings (address);
CREATE INDEX idx_claimed_buildings_verification_status ON claimed_buildings (verification_status);
CREATE UNIQUE INDEX idx_claimed_buildings_landlord_address ON claimed_buildings (landlord_id, address);

ALTER TABLE claimed_buildings ENABLE ROW LEVEL SECURITY;

-- Public: select verified buildings only
CREATE POLICY "Anyone can view verified buildings"
  ON claimed_buildings FOR SELECT
  USING (verified = true);

-- Owner: select own (including unverified)
CREATE POLICY "Landlords can view own buildings"
  ON claimed_buildings FOR SELECT
  TO authenticated
  USING (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()));

-- Owner: insert
CREATE POLICY "Landlords can claim buildings"
  ON claimed_buildings FOR INSERT
  TO authenticated
  WITH CHECK (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()));

-- Owner: update own
CREATE POLICY "Landlords can update own buildings"
  ON claimed_buildings FOR UPDATE
  TO authenticated
  USING (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()))
  WITH CHECK (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()));

-- Admin: select all
CREATE POLICY "Admin can view all buildings"
  ON claimed_buildings FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'njecelin17@gmail.com');

-- Admin: update all
CREATE POLICY "Admin can update all buildings"
  ON claimed_buildings FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'njecelin17@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'njecelin17@gmail.com');

-- Service role: full access
CREATE POLICY "Service role full access claimed_buildings"
  ON claimed_buildings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. landlord_alerts
-- ============================================================
CREATE TABLE landlord_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlord_profiles(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES claimed_buildings(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('violation', '311_complaint', 'review')),
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_landlord_alerts_landlord_id ON landlord_alerts (landlord_id);
CREATE INDEX idx_landlord_alerts_building_id ON landlord_alerts (building_id);
CREATE INDEX idx_landlord_alerts_landlord_read ON landlord_alerts (landlord_id, read);
CREATE INDEX idx_landlord_alerts_created_at ON landlord_alerts (created_at DESC);

ALTER TABLE landlord_alerts ENABLE ROW LEVEL SECURITY;

-- Owner: select own alerts
CREATE POLICY "Landlords can view own alerts"
  ON landlord_alerts FOR SELECT
  TO authenticated
  USING (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()));

-- Owner: update own alerts (mark as read)
CREATE POLICY "Landlords can update own alerts"
  ON landlord_alerts FOR UPDATE
  TO authenticated
  USING (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()))
  WITH CHECK (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()));

-- INSERT restricted to service_role only (system-generated)
-- No insert policy for authenticated users

-- Admin: select all
CREATE POLICY "Admin can view all alerts"
  ON landlord_alerts FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'njecelin17@gmail.com');

-- Service role: full access
CREATE POLICY "Service role full access landlord_alerts"
  ON landlord_alerts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. landlord_responses
-- ============================================================
CREATE TABLE landlord_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES landlord_profiles(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES claimed_buildings(id) ON DELETE CASCADE,
  violation_id text,
  response_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_landlord_responses_building_id ON landlord_responses (building_id);
CREATE INDEX idx_landlord_responses_landlord_id ON landlord_responses (landlord_id);

ALTER TABLE landlord_responses ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read responses (shown on building pages)
CREATE POLICY "Anyone can view responses"
  ON landlord_responses FOR SELECT
  USING (true);

-- Owner: insert own responses
CREATE POLICY "Landlords can create own responses"
  ON landlord_responses FOR INSERT
  TO authenticated
  WITH CHECK (landlord_id IN (SELECT id FROM landlord_profiles WHERE user_id = auth.uid()));

-- Service role: full access
CREATE POLICY "Service role full access landlord_responses"
  ON landlord_responses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 5. address_watch
-- ============================================================
CREATE TABLE address_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  address text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_address_watch_address ON address_watch (address);
CREATE INDEX idx_address_watch_email ON address_watch (email);
CREATE UNIQUE INDEX idx_address_watch_email_address ON address_watch (email, address);

ALTER TABLE address_watch ENABLE ROW LEVEL SECURITY;

-- Authenticated: select own watches
CREATE POLICY "Users can view own watches"
  ON address_watch FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated: insert own watches
CREATE POLICY "Users can create own watches"
  ON address_watch FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Anonymous: insert (must have user_id IS NULL)
CREATE POLICY "Anonymous can create watches"
  ON address_watch FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Authenticated: update own watches
CREATE POLICY "Users can update own watches"
  ON address_watch FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Authenticated: delete own watches
CREATE POLICY "Users can delete own watches"
  ON address_watch FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role: full access
CREATE POLICY "Service role full access address_watch"
  ON address_watch FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
