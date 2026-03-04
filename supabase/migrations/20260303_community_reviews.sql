-- Community Reviews table
-- Stores AI-summarized review data from the Python scraper (Reddit + Google Reviews)
-- Separate from the user-submitted `reviews` table

CREATE TABLE IF NOT EXISTS community_reviews (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  address       TEXT NOT NULL,
  building_name TEXT DEFAULT '',
  management_company TEXT DEFAULT '',
  overall_sentiment TEXT NOT NULL DEFAULT 'Neutral',
  overall_summary TEXT DEFAULT '',
  key_themes    TEXT[] DEFAULT '{}',
  raw_review_count INTEGER DEFAULT 0,
  relevant_review_count INTEGER DEFAULT 0,
  reports       JSONB DEFAULT '[]'::jsonb,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive address lookup index
CREATE INDEX IF NOT EXISTS idx_community_reviews_address
  ON community_reviews (UPPER(address));

-- Unique constraint on uppercase address for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_reviews_address_unique
  ON community_reviews (UPPER(address));

-- RLS
ALTER TABLE community_reviews ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required)
CREATE POLICY "community_reviews_public_read"
  ON community_reviews FOR SELECT
  USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "community_reviews_service_write"
  ON community_reviews FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
