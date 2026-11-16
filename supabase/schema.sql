-- ============================================================
-- Two Up — Supabase schema (Phase 2)
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Creates the tables, turns on Row Level Security, and allows any logged-in
-- user to read/write (there are only ever two of you). The Google key and the
-- service-role key never appear here or in the frontend.
-- ============================================================

-- --- Places we know and like ---
create table if not exists public.places (
  id                uuid primary key default gen_random_uuid(),
  google_place_id   text,
  name              text not null,
  category          text not null check (category in
                      ('coffee','food','activity','view','drinks','dessert')),
  area              text,
  est_cost_for_two  numeric,                         -- AUD, our own estimate
  vibe              text[] default '{}',             -- chill | social | adventurous
  setting           text check (setting in ('indoor','outdoor','either')),
  lat               double precision,
  lng               double precision,
  our_notes         text,
  our_rating        numeric,
  photo_url         text,                            -- manual photo link (no Google)
  hours             text,                            -- manual opening hours (no Google)
  deals             jsonb,                            -- weekly specials: {mon:"...", tue:"..."}
  cuisine           text,                             -- explicit cuisine tag: italian|steak|japanese|fillers
  zone              text,                             -- exploration zone: royal|bluemtns|outback
  treat             text,                             -- sweet-treat brand: yochi
  added_by          uuid references auth.users(id),
  created_at        timestamptz default now()
);

-- If the table already existed from an earlier run, add the newer columns.
alter table public.places add column if not exists photo_url text;
alter table public.places add column if not exists hours text;
alter table public.places add column if not exists deals jsonb;
alter table public.places add column if not exists cuisine text;
alter table public.places add column if not exists zone text;
alter table public.places add column if not exists treat text;

-- --- Saved day plans ---
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  date        date,
  mode        text default 'together' check (mode in ('together','surprise')),
  template    text,
  created_by  uuid references auth.users(id),
  stops       jsonb default '[]'::jsonb,   -- [{ placeId, time, hint?, reveal_at? }]
  plan_hints  text,
  budget      numeric,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- --- Daily API-usage counters (used by the Edge Function in Phase 3) ---
create table if not exists public.api_usage (
  day    date not null,
  kind   text not null,
  count  int  default 0,
  primary key (day, kind)
);

-- --- Row Level Security ---
alter table public.places    enable row level security;
alter table public.plans     enable row level security;
alter table public.api_usage enable row level security;

-- Any authenticated user (only the two of you exist) can do everything on
-- places and plans. Re-runnable: drop first so this script is idempotent.
drop policy if exists "authenticated full access" on public.places;
create policy "authenticated full access" on public.places
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "authenticated full access" on public.plans;
create policy "authenticated full access" on public.plans
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- api_usage has RLS on and NO user policy on purpose: only the Edge Function
-- (service role, which bypasses RLS) ever touches it. Nothing to add here.

-- Keep plans.updated_at fresh on every update.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();
