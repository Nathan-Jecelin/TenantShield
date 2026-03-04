-- Add new fields for improved review form and moderation queue

-- Duration lived at the building
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS duration_lived text;

-- Would recommend toggle
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS would_recommend boolean;

-- Separate good/bad text fields
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS good_text text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS bad_text text;

-- Moderation status: approved, pending, rejected
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';

-- Flag reason for moderators
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flag_reason text;

-- Index for moderation queue queries
CREATE INDEX IF NOT EXISTS idx_reviews_moderation_status ON reviews(moderation_status);

-- Allow anonymous review submissions via service role (API route handles spam checks)
-- The existing "Authenticated users can insert own reviews" policy stays for logged-in users.
-- We add a service-role bypass so the API route can insert on behalf of anonymous users.
-- Service role already bypasses RLS, so no policy change needed.

-- Allow service role to update moderation status
-- Service role already bypasses RLS, so no policy change needed.
