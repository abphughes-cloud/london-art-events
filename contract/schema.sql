-- Shared contract: London art events
-- Run once in the Supabase SQL editor (Lovable Cloud uses Supabase).
-- Ingestion side WRITES to these tables. App side only READS them.
-- Change this file by agreement only: it is the seam between the two halves.

create extension if not exists pgcrypto;

create type event_type as enum (
  'exhibition', 'private_view', 'workshop', 'talk', 'open_studio',
  'performance', 'screening', 'fair', 'tour', 'other'
);

create type price_type as enum ('free', 'paid', 'donation', 'unknown');

create table if not exists events (
  id               uuid primary key default gen_random_uuid(),

  -- what
  title            text not null,
  event_type       event_type not null default 'other',
  description      text,                 -- our own wording, 1-2 sentences
  artists          text[] not null default '{}',
  art_forms        text[] not null default '{}',  -- e.g. {printmaking, painting}
  tags             text[] not null default '{}',  -- e.g. {family, emerging, quiet}
  image_url        text,

  -- when (Europe/London; an exhibition runs start_date..end_date,
  -- a one-off event also has start_time / end_time)
  start_date       date not null,
  end_date         date,
  start_time       time,
  end_time         time,

  -- where
  venue_name       text,
  address          text,
  postcode         text,
  area             text,                 -- e.g. Peckham, Mayfair
  lat              double precision,
  lng              double precision,

  -- cost and booking
  price_type       price_type not null default 'unknown',
  price_min_gbp    numeric,
  booking_required boolean,
  booking_url      text,

  -- provenance (always link back to the source)
  source_name      text not null,
  source_url       text not null,
  scraped_at       timestamptz not null default now(),
  confidence       real,                 -- 0..1 extraction confidence

  -- dedupe: lower(title) | lower(venue_name) | start_date, set by ingestion
  dedupe_key       text not null,

  unique (source_name, source_url),
  unique (dedupe_key)
);

create index if not exists events_dates_idx on events (start_date, end_date);
create index if not exists events_type_idx  on events (event_type);
create index if not exists events_forms_idx on events using gin (art_forms);

-- Registry of where events come from (ingestion side owns this).
create table if not exists sources (
  name          text primary key,
  url           text not null,
  method        text not null,          -- api | scrape | llm_extract | manual
  priority      int  not null default 2,
  last_run_at   timestamptz,
  last_count    int
);

-- App reads with the public (anon) key; only the service role writes.
alter table events  enable row level security;
alter table sources enable row level security;
create policy "public read events"  on events  for select using (true);
create policy "public read sources" on sources for select using (true);
