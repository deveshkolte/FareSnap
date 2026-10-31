-- FareSnap Waze-Style Crowdsourced Fare & Surge Pool Schema (Supabase / PostgreSQL)
-- Run this script in your Supabase SQL Editor to enable global crowdsourced surge pooling.

create table if not exists public.fare_reports (
  id bigint generated always as identity primary key,
  app text not null,
  city text not null,
  pickup_area text default '',
  distance_km numeric(6,2) not null check (distance_km > 0 and distance_km <= 250),
  quoted_fare numeric(8,2) not null check (quoted_fare >= 15 and quoted_fare <= 10000),
  app_version text default '1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists idx_fare_reports_city_dist
  on public.fare_reports (city, distance_km, id desc);

create index if not exists idx_fare_reports_city_created
  on public.fare_reports (city, created_at desc);

alter table public.fare_reports enable row level security;

drop policy if exists "Allow public read of recent fare reports" on public.fare_reports;
create policy "Allow public read of recent fare reports"
  on public.fare_reports
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow validated anonymous fare report inserts" on public.fare_reports;
create policy "Allow validated anonymous fare report inserts"
  on public.fare_reports
  for insert
  to anon, authenticated
  with check (
    quoted_fare >= 15
    and quoted_fare <= 10000
    and distance_km > 0
    and (quoted_fare / greatest(distance_km, 1)) between 3 and 350
  );
