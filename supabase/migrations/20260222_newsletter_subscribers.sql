-- Newsletter subscribers table
CREATE TABLE newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);

CREATE INDEX idx_newsletter_subscribers_email ON newsletter_subscribers (email);
CREATE INDEX idx_newsletter_subscribers_status ON newsletter_subscribers (status);
CREATE UNIQUE INDEX idx_newsletter_subscribers_unsubscribe_token ON newsletter_subscribers (unsubscribe_token);

-- Newsletter send history
CREATE TABLE newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz NOT NULL DEFAULT now(),
  subscriber_count integer NOT NULL DEFAULT 0,
  blog_post_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed'))
);

-- RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert)
CREATE POLICY "Anyone can subscribe"
  ON newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Service role can do everything (used by API routes)
CREATE POLICY "Service role full access subscribers"
  ON newsletter_subscribers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access sends"
  ON newsletter_sends FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
