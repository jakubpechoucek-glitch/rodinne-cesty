-- Flight entitlement: nárok na letenky rodiny (aplikováno jako migrace flight_entitlement_schema_v1).
-- Neobsahuje žádná data. Přístup: jen přihlášení členové rodiny (je_clen()), anon nemá nic.

create table public.travel_entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  valid_from date not null,
  valid_to date not null,
  tickets integer not null check (tickets > 0),
  reason text not null default 'Base entitlement',
  source_note text not null default '',
  created_at timestamptz not null default now(),
  check (valid_to >= valid_from)
);

create table public.travel_entitlement_limits (
  id uuid primary key default gen_random_uuid(),
  valid_from date not null,
  valid_to date,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create table public.travel_fx_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$' and currency <> 'CZK'),
  czk_per_unit numeric(18,8) not null check (czk_per_unit > 0),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (rate_date, currency)
);

create table public.travel_tickets (
  id uuid primary key default gen_random_uuid(),
  person_id text references public.travel_people(id) on delete set null,
  status text not null check (status in ('booked','flown','cancelled','summary')),
  payment_source text not null check (payment_source in ('benefit','family')),
  purchase_date date,
  outbound_date date,
  return_date date,
  from_iata text check (from_iata ~ '^[A-Z]{3}$'),
  to_iata text check (to_iata ~ '^[A-Z]{3}$'),
  cabin text not null default 'economy' check (cabin in ('economy','business')),
  price_amount numeric(14,2) check (price_amount >= 0),
  price_currency text check (price_currency ~ '^[A-Z]{3}$'),
  business_surcharge_amount numeric(14,2) not null default 0 check (business_surcharge_amount >= 0),
  ticket_count integer check (ticket_count >= 0),
  summary_year integer,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (return_date is null or outbound_date is null or return_date >= outbound_date),
  check (status <> 'summary' or (ticket_count is not null and summary_year is not null)),
  check (status = 'summary' or (from_iata is not null and to_iata is not null and outbound_date is not null
         and purchase_date is not null and price_amount is not null and price_currency is not null))
);

create index travel_tickets_outbound_idx on public.travel_tickets (outbound_date);

do $$
declare t text;
begin
  foreach t in array array['travel_entitlement_grants','travel_entitlement_limits','travel_fx_rates','travel_tickets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy travel_family on public.%I for all to authenticated using (public.je_clen()) with check (public.je_clen())', t);
  end loop;
end $$;
