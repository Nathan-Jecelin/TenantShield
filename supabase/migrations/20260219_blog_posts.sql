-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX idx_blog_posts_published ON blog_posts (published, created_at DESC);

-- RLS policies
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Published posts are viewable by everyone"
  ON blog_posts FOR SELECT
  USING (published = true);

-- Admin can do everything (using the same admin email pattern)
CREATE POLICY "Admin can manage blog posts"
  ON blog_posts FOR ALL
  USING (auth.jwt() ->> 'email' = 'njecelin17@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'njecelin17@gmail.com');
