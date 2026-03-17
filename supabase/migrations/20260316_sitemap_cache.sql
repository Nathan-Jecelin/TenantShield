-- Cache table for pre-generated sitemap XML chunks.
-- Populated by /api/cron/refresh-sitemap, served by /api/sitemap/[id].
create table if not exists sitemap_cache (
  chunk_id  int primary key,
  xml_content text not null,
  url_count   int not null default 0,
  updated_at  timestamptz not null default now()
);

-- Allow the service role full access (default), anon can read
alter table sitemap_cache enable row level security;

create policy "Anyone can read sitemap cache"
  on sitemap_cache for select
  using (true);

create policy "Service role can upsert sitemap cache"
  on sitemap_cache for all
  using (true)
  with check (true);
