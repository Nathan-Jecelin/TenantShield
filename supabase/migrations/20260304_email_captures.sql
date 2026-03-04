-- Email captures for PDF building report lead generation
CREATE TABLE email_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  address text NOT NULL,
  building_name text DEFAULT '',
  report_sent boolean NOT NULL DEFAULT false,
  email_opened boolean NOT NULL DEFAULT false,
  followup_sent boolean NOT NULL DEFAULT false,
  followup_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_captures_followup ON email_captures (followup_sent, created_at);

-- RLS: service_role bypasses automatically, anon can insert
ALTER TABLE email_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON email_captures
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow service role full access" ON email_captures
  FOR ALL TO service_role USING (true) WITH CHECK (true);
