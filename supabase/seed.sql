-- ============================================================
-- TenantShield Database Schema + Seed Data
-- Run this in the Supabase SQL Editor to set up your database
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── TABLES ───────────────────────────────────────────────────

create table landlords (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  neighborhood text not null,
  type text not null,
  violations int not null default 0,
  complaints int not null default 0,
  review_count int not null default 0,
  score_maintenance float not null default 0,
  score_communication float not null default 0,
  score_deposit float not null default 0,
  score_honesty float not null default 0,
  score_overall float not null default 0,
  created_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid not null references landlords(id) on delete cascade,
  address text not null
);

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid not null references landlords(id) on delete cascade,
  author text not null,
  rating int not null check (rating between 1 and 5),
  text text not null,
  helpful int not null default 0,
  maintenance int check (maintenance between 1 and 5),
  communication int check (communication between 1 and 5),
  deposit int check (deposit between 1 and 5),
  honesty int check (honesty between 1 and 5),
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_addresses_landlord on addresses(landlord_id);
create index idx_reviews_landlord on reviews(landlord_id);
-- Note: gin_trgm_ops index omitted (pg_trgm extension not available on free tier)

-- ─── SEED DATA ────────────────────────────────────────────────

-- Landlord 1: Greystar Property Management
insert into landlords (slug, name, neighborhood, type, violations, complaints, review_count, score_maintenance, score_communication, score_deposit, score_honesty, score_overall)
values ('ll-001', 'Greystar Property Management', 'Gold Coast / Lakeview', 'Property Management Company', 12, 23, 47, 2.1, 1.8, 2.5, 1.9, 2.1);

insert into addresses (landlord_id, address)
select id, '1550 N Lake Shore Dr, Chicago, IL 60610' from landlords where slug = 'll-001';
insert into addresses (landlord_id, address)
select id, '2800 N Lake Shore Dr, Chicago, IL 60657' from landlords where slug = 'll-001';

insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Former Tenant', 2, 'Maintenance requests took 3+ weeks to address. The heating went out in January and they told me to ''use a space heater.'' Security deposit was returned minus bogus charges for ''deep cleaning'' despite leaving the unit spotless.', 34, '2025-11-14'::timestamptz from landlords where slug = 'll-001';
insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Verified Renter', 1, 'Listing showed renovated kitchen with new appliances. Moved in to find the same 1990s setup with a broken dishwasher. When I complained, they said the photos were from a ''model unit.'' Total bait and switch.', 51, '2025-09-22'::timestamptz from landlords where slug = 'll-001';
insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Anonymous Tenant', 3, 'Location is great and the building itself is fine. Management is just slow and unresponsive. If nothing breaks, you''re golden. The moment you need something fixed, good luck.', 18, '2025-07-03'::timestamptz from landlords where slug = 'll-001';

-- Landlord 2: Lincoln Property Company
insert into landlords (slug, name, neighborhood, type, violations, complaints, review_count, score_maintenance, score_communication, score_deposit, score_honesty, score_overall)
values ('ll-002', 'Lincoln Property Company', 'Streeterville / River North', 'Property Management Company', 2, 5, 31, 3.8, 4.1, 3.5, 4.0, 3.9);

insert into addresses (landlord_id, address)
select id, '225 N Columbus Dr, Chicago, IL 60601' from landlords where slug = 'll-002';
insert into addresses (landlord_id, address)
select id, '500 W Superior St, Chicago, IL 60654' from landlords where slug = 'll-002';

insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Current Tenant', 4, 'Pretty responsive management. Put in a work order for a leaky faucet and it was fixed the next day. Building amenities are well maintained. Only downside is the rent increases each year have been aggressive.', 22, '2025-12-01'::timestamptz from landlords where slug = 'll-002';
insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Former Tenant', 4, 'Good experience overall. Got my full deposit back within 30 days. The building was clean and well-managed. Would rent from them again.', 15, '2025-08-15'::timestamptz from landlords where slug = 'll-002';

-- Landlord 3: Peak Properties
insert into landlords (slug, name, neighborhood, type, violations, complaints, review_count, score_maintenance, score_communication, score_deposit, score_honesty, score_overall)
values ('ll-003', 'Peak Properties', 'Lakeview / Lincoln Park', 'Property Management Company', 34, 56, 89, 1.5, 1.2, 1.0, 1.3, 1.2);

insert into addresses (landlord_id, address)
select id, '3121 N Broadway, Chicago, IL 60657' from landlords where slug = 'll-003';
insert into addresses (landlord_id, address)
select id, '1415 W Diversey Pkwy, Chicago, IL 60614' from landlords where slug = 'll-003';
insert into addresses (landlord_id, address)
select id, '2644 N Ashland Ave, Chicago, IL 60614' from landlords where slug = 'll-003';

insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Verified Renter', 1, 'DO NOT RENT FROM PEAK. They will find every excuse to keep your deposit. I documented the apartment condition with photos at move-in and move-out, and they still charged me $800 for ''damages'' that were pre-existing. Had to threaten legal action to get any money back.', 89, '2026-01-10'::timestamptz from landlords where slug = 'll-003';
insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Former Tenant', 1, 'Roach infestation that they refused to properly treat for 4 months. They sent a guy with a can of Raid instead of a real exterminator. Multiple neighbors had the same issue. Also the laundry machines were broken for 6 weeks.', 67, '2025-10-28'::timestamptz from landlords where slug = 'll-003';
insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Anonymous Tenant', 2, 'They seem friendly at first but once you sign the lease, they become completely unresponsive. I called about a broken A/C in July and didn''t get it fixed until September. By then, summer was over.', 41, '2025-06-19'::timestamptz from landlords where slug = 'll-003';

-- Landlord 4: Beal Properties
insert into landlords (slug, name, neighborhood, type, violations, complaints, review_count, score_maintenance, score_communication, score_deposit, score_honesty, score_overall)
values ('ll-004', 'Beal Properties', 'Uptown / Edgewater', 'Property Management Company', 0, 1, 22, 4.2, 4.5, 4.7, 4.3, 4.4);

insert into addresses (landlord_id, address)
select id, '5050 N Sheridan Rd, Chicago, IL 60640' from landlords where slug = 'll-004';
insert into addresses (landlord_id, address)
select id, '4840 N Marine Dr, Chicago, IL 60640' from landlords where slug = 'll-004';

insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Current Tenant', 5, 'Honestly the best landlord I''ve had in Chicago. Maintenance requests are handled same-day. They actually care about the building. Rent is fair for the area. Full deposit returned promptly.', 28, '2025-11-30'::timestamptz from landlords where slug = 'll-004';
insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Former Tenant', 4, 'Very solid property management. Building was always clean, they communicated well about any building work, and the lease terms were straightforward with no hidden fees. Would recommend.', 19, '2025-05-12'::timestamptz from landlords where slug = 'll-004';

-- Landlord 5: Planned Property Management
insert into landlords (slug, name, neighborhood, type, violations, complaints, review_count, score_maintenance, score_communication, score_deposit, score_honesty, score_overall)
values ('ll-005', 'Planned Property Management', 'Lakeview / DePaul Area', 'Property Management Company', 8, 19, 53, 2.8, 2.5, 2.0, 2.7, 2.5);

insert into addresses (landlord_id, address)
select id, '2936 N Clark St, Chicago, IL 60657' from landlords where slug = 'll-005';
insert into addresses (landlord_id, address)
select id, '1639 W Fullerton Ave, Chicago, IL 60614' from landlords where slug = 'll-005';

insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Verified Renter', 2, 'Mixed experience. The apartment itself was nice but the management nickel-and-dimes you on everything. Charged me for ''new blinds'' that were already broken when I moved in. Hard to get anyone on the phone.', 31, '2025-12-20'::timestamptz from landlords where slug = 'll-005';
insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Anonymous Tenant', 3, 'Average for Chicago. Not the worst, not the best. Maintenance is slow but they do eventually get to it. Just document everything and you''ll be fine.', 12, '2025-09-05'::timestamptz from landlords where slug = 'll-005';

-- Landlord 6: MCZ Development
insert into landlords (slug, name, neighborhood, type, violations, complaints, review_count, score_maintenance, score_communication, score_deposit, score_honesty, score_overall)
values ('ll-006', 'MCZ Development', 'Near North Side', 'Developer / Manager', 3, 7, 15, 3.5, 3.2, 3.8, 3.6, 3.5);

insert into addresses (landlord_id, address)
select id, '1460 N Sandburg Terrace, Chicago, IL 60610' from landlords where slug = 'll-006';

insert into reviews (landlord_id, author, rating, text, helpful, created_at)
select id, 'Current Tenant', 4, 'Decent building, good location. Maintenance could be faster but they''re generally fair. Got most of my deposit back. No major complaints.', 8, '2025-10-10'::timestamptz from landlords where slug = 'll-006';


-- ─── ROW LEVEL SECURITY ───────────────────────────────────────

alter table landlords enable row level security;
alter table addresses enable row level security;
alter table reviews enable row level security;

-- Public read access
create policy "Public read landlords" on landlords for select using (true);
create policy "Public read addresses" on addresses for select using (true);
create policy "Public read reviews" on reviews for select using (true);

-- Anyone can submit reviews
create policy "Anyone can insert reviews" on reviews for insert with check (true);

-- Allow updating landlord scores (for recalculating after new review)
create policy "Allow score updates" on landlords for update using (true);
