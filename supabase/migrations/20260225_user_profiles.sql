-- Create user_profiles table for customizable display names and avatars
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read user profiles (so names/avatars show on reviews)
CREATE POLICY "Anyone can read user profiles"
  ON user_profiles FOR SELECT
  USING (true);

-- Users can create their own profile
CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role has full access
CREATE POLICY "Service role full access"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add anonymous column to reviews (default true for backward compat)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT true;
