-- Analytics events table for tracking user activity
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_data jsonb default '{}',
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Indexes for dashboard queries
create index if not exists idx_analytics_events_created_at on public.analytics_events (created_at desc);
create index if not exists idx_analytics_events_event_type on public.analytics_events (event_type);

-- RLS
alter table public.analytics_events enable row level security;

-- Anyone can insert (so anonymous visitors are tracked)
create policy "Anyone can insert analytics events"
  on public.analytics_events for insert
  with check (true);

-- Only admin can read analytics data
create policy "Admin can read analytics events"
  on public.analytics_events for select
  using (auth.jwt() ->> 'email' = 'njecelin17@gmail.com');
