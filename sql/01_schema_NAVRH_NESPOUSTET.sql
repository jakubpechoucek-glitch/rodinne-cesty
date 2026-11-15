-- Rodinné cesty: návrh databázového schématu v1.0
-- CÍL: existující Supabase projekt Rozcestníku (stejný jako Plánovač).
-- STAV: NÁVRH — NESPouštěno, NENÍ aplikováno v produkci.
-- OČEKÁVÁNÍ: existující public.je_clen() vrací boolean a bezpečně kontroluje členství.
-- Před použitím: revize RLS/Storage, test na stagingu, schválení vlastníkem.

begin;

create table public.travel_people (
  id text primary key,
  display_name text not null,
  planner_person_key text unique,
  color text,
  active boolean not null default true
);

create table public.travel_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_iso2 text not null check (country_iso2 ~ '^[A-Z]{2}$'),
  iata_code text unique check (iata_code is null or iata_code ~ '^[A-Z]{3}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  check ((latitude is null) = (longitude is null))
);

create table public.travel_trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'cancelled')),
  category text not null default 'private'
    check (category in ('family', 'private', 'work')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end is null or planned_start is null or planned_end >= planned_start),
  check (actual_end is null or actual_start is null or actual_end >= actual_start)
);

create table public.travel_trip_people (
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  person_id text not null references public.travel_people(id),
  participation text not null default 'planned'
    check (participation in ('planned', 'confirmed')),
  primary key (trip_id, person_id)
);

create table public.travel_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  stop_order integer not null check (stop_order > 0),
  country_iso2 text not null check (country_iso2 ~ '^[A-Z]{2}$'),
  location_id uuid references public.travel_locations(id),
  arrival_date date,
  departure_date date,
  date_precision text not null default 'unknown'
    check (date_precision in ('exact','month','year','unknown')),
  kind text not null default 'stay'
    check (kind in ('stay','transit','airport_only')),
  verification text not null default 'proposed'
    check (verification in ('proposed','verified','rejected')),
  notes text not null default '',
  unique (trip_id, stop_order),
  check (departure_date is null or arrival_date is null or departure_date >= arrival_date),
  check ((date_precision = 'unknown' and arrival_date is null)
      or (date_precision <> 'unknown' and arrival_date is not null)),
  check (date_precision <> 'month' or extract(day from arrival_date) = 1),
  check (date_precision <> 'year' or
    (extract(month from arrival_date) = 1 and extract(day from arrival_date) = 1))
);

create table public.travel_stop_people (
  stop_id uuid not null references public.travel_stops(id) on delete cascade,
  person_id text not null references public.travel_people(id),
  presence text not null default 'planned'
    check (presence in ('planned','confirmed')),
  primary key (stop_id, person_id)
);

create table public.travel_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  leg_order integer not null check (leg_order > 0),
  from_location_id uuid references public.travel_locations(id),
  to_location_id uuid references public.travel_locations(id),
  departure_date date,
  arrival_date date,
  mode text not null default 'flight'
    check (mode in ('flight','train','car','bus','boat','other')),
  flight_number text,
  verification text not null default 'proposed'
    check (verification in ('proposed','verified','rejected')),
  notes text not null default '',
  unique (trip_id, leg_order),
  check (arrival_date is null or departure_date is null or arrival_date >= departure_date),
  check (from_location_id is null or to_location_id is null or from_location_id <> to_location_id)
);

create table public.travel_leg_people (
  leg_id uuid not null references public.travel_legs(id) on delete cascade,
  person_id text not null references public.travel_people(id),
  presence text not null default 'planned'
    check (presence in ('planned','confirmed')),
  primary key (leg_id, person_id)
);

-- Nahrát lze jen bezpečně oříznutý výřez razítka do privátního bucketu;
-- do této tabulky patří pouze název souboru, ne obsah fotografie ani čísla pasů.
create table public.travel_evidence (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.travel_trips(id) on delete set null,
  stop_id uuid references public.travel_stops(id) on delete set null,
  leg_id uuid references public.travel_legs(id) on delete set null,
  person_id text references public.travel_people(id),
  evidence_type text not null
    check (evidence_type in ('passport_stamp','boarding_pass','ticket','photo','manual_note','planner')),
  event_type text not null default 'other'
    check (event_type in ('arrival','departure','visa','other')),
  observed_date date,
  date_precision text not null default 'unknown'
    check (date_precision in ('exact','month','year','unknown')),
  country_iso2 text check (country_iso2 is null or country_iso2 ~ '^[A-Z]{2}$'),
  private_file_path text,
  confidence text not null default 'uncertain'
    check (confidence in ('certain','probable','uncertain')),
  extraction_status text not null default 'proposed'
    check (extraction_status in ('proposed','reviewed','rejected')),
  source_note text not null default '',
  created_at timestamptz not null default now(),
  check ((date_precision = 'unknown' and observed_date is null)
      or (date_precision <> 'unknown' and observed_date is not null))
);

-- Polymorfní vazba bez FK na cizí tabulku: zdroj se může změnit nebo smazat.
-- Dva odkazy (např. plan_cesty + plan_volno) smějí ukazovat na stejnou cestu.
create table public.travel_plan_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.travel_trips(id) on delete cascade,
  source_table text not null check (source_table in ('plan_cesty','plan_volno')),
  source_id bigint not null,
  last_seen_at timestamptz not null default now(),
  unique (source_table, source_id)
);

create index travel_trips_dates_idx on public.travel_trips (actual_start, planned_start);
create index travel_stops_country_date_idx on public.travel_stops (country_iso2, arrival_date);
create index travel_stops_trip_idx on public.travel_stops (trip_id);
create index travel_legs_trip_idx on public.travel_legs (trip_id);
create index travel_plan_links_trip_idx on public.travel_plan_links (trip_id);
create index travel_evidence_trip_idx on public.travel_evidence (trip_id);

-- Všechny tabulky jsou soukromé pro členy rodiny, i když jsou v public schema.
-- POZOR: pro finální nasazení prověřit, že public.je_clen() nespoléhá na
-- uživatelem upravitelná JWT user_metadata.
alter table public.travel_people enable row level security;
alter table public.travel_locations enable row level security;
alter table public.travel_trips enable row level security;
alter table public.travel_trip_people enable row level security;
alter table public.travel_stops enable row level security;
alter table public.travel_stop_people enable row level security;
alter table public.travel_legs enable row level security;
alter table public.travel_leg_people enable row level security;
alter table public.travel_evidence enable row level security;
alter table public.travel_plan_links enable row level security;

create policy travel_family on public.travel_people for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_locations for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_trips for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_trip_people for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_stops for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_stop_people for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_legs for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_leg_people for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_evidence for all to authenticated
  using (public.je_clen()) with check (public.je_clen());
create policy travel_family on public.travel_plan_links for all to authenticated
  using (public.je_clen()) with check (public.je_clen());

-- Novější Supabase projekty již nevystavují nové tabulky Data API automaticky.
-- Přístup je explicitně pro authenticated; RLS následně kontroluje členství.
grant select, insert, update, delete on
  public.travel_people,
  public.travel_locations,
  public.travel_trips,
  public.travel_trip_people,
  public.travel_stops,
  public.travel_stop_people,
  public.travel_legs,
  public.travel_leg_people,
  public.travel_evidence,
  public.travel_plan_links
  to authenticated;

commit;

-- NEZAHRNUTO: soukromý Storage bucket + storage.objects RLS.
-- Je nutné nastavit samostatně přes Storage API / dashboard po schválení návrhu.
-- NEZAHRNUTO: importní funkce, validace nesouladu country_iso2 / location_id,
-- a ochrana změn již ověřené historické cesty. Tyto invarianty budou
-- potvrzeny samostatně v implementační fázi a otestovány před produkcí.