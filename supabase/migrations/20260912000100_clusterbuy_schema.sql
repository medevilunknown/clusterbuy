-- ClusterBuy operational schema
-- Applied through the Supabase CLI. This migration is additive and idempotent.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('BUYER', 'SELLER', 'WAREHOUSE', 'ADMIN')),
  cluster text,
  gstin text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  name text,
  role text not null default 'BUYER' check (role in ('BUYER', 'SELLER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER', 'ADMIN', 'SUPER_ADMIN')),
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.demands (
  id uuid primary key default gen_random_uuid(),
  demand_no text not null unique,
  buyer_id uuid references public.companies(id) on delete set null,
  material text not null,
  grade text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'tonnes',
  required_date date,
  cluster text,
  pool_no text,
  status text not null default 'Matching',
  quotes integer not null default 0 check (quotes >= 0),
  spec jsonb not null default '{}'::jsonb,
  commercial jsonb not null default '{}'::jsonb,
  delivery_pref text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  pool_no text not null unique,
  material text not null,
  grade text,
  cluster text,
  target_qty numeric(14,3) not null check (target_qty > 0),
  current_qty numeric(14,3) not null default 0 check (current_qty >= 0),
  est_individual numeric(14,2),
  est_pooled numeric(14,2),
  closing_date date,
  auction_date date,
  status text not null,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  supplier_id uuid references public.companies(id) on delete set null,
  material_price numeric(14,2) not null,
  freight numeric(14,2) not null default 0,
  handling numeric(14,2) not null default 0,
  platform_fee numeric(14,2) not null default 0,
  landed_cost numeric(14,2) not null,
  lead_time integer,
  moq numeric(14,3),
  payment_terms text,
  rating numeric(3,2),
  quality_score numeric(5,2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  auction_no text not null unique,
  pool_id uuid references public.pools(id) on delete set null,
  material text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  hub text,
  cluster text,
  status text not null default 'Scheduled',
  ends_at timestamptz,
  current_bid numeric(14,2),
  decrement numeric(14,2) not null default 1 check (decrement > 0),
  bids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  buyer_id uuid references public.companies(id) on delete set null,
  supplier_id uuid references public.companies(id) on delete set null,
  pool_id uuid references public.pools(id) on delete set null,
  warehouse text,
  material text not null,
  grade text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'tonnes',
  state text not null,
  payment_status text,
  cost jsonb not null default '{}'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  lot_no text not null unique,
  order_id uuid references public.orders(id) on delete cascade,
  material text not null,
  grade text,
  supplier_id uuid references public.companies(id) on delete set null,
  warehouse text,
  original_qty numeric(14,3) not null default 0,
  received_qty numeric(14,3) not null default 0,
  available_qty numeric(14,3) not null default 0,
  allocated_qty numeric(14,3) not null default 0,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_no text not null unique,
  order_id uuid references public.orders(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_location text,
  to_location text,
  material text,
  quantity numeric(14,3),
  vehicle text,
  driver text,
  driver_phone text,
  status text not null,
  buyer_cluster text,
  origin_lat numeric(10,7), origin_lng numeric(10,7),
  destination_lat numeric(10,7), destination_lng numeric(10,7),
  distance_km numeric(12,3),
  progress numeric(5,4) not null default 0 check (progress between 0 and 1),
  eta_at timestamptz,
  pod boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.inventory_lots(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  status text not null,
  decision text check (decision in ('PASS', 'FAIL')),
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.inventory_lots(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  buyer_id uuid references public.companies(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'Allocated',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  supplier_id uuid references public.companies(id) on delete set null,
  order_value numeric(16,2) not null default 0,
  platform_deduction numeric(16,2) not null default 0,
  logistics_deduction numeric(16,2) not null default 0,
  tds numeric(16,2) not null default 0,
  net numeric(16,2) not null default 0,
  status text not null,
  expected_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  case_no text not null unique,
  order_id uuid references public.orders(id) on delete set null,
  type text,
  title text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.action_queue (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  details text,
  priority text,
  assigned text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  role text,
  title text not null,
  reference text,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists orders_buyer_id_idx on public.orders(buyer_id);
create index if not exists orders_state_idx on public.orders(state);
create index if not exists shipments_order_id_idx on public.shipments(order_id);
create index if not exists shipments_status_idx on public.shipments(status);
create index if not exists demands_buyer_id_idx on public.demands(buyer_id);
create index if not exists auctions_ends_at_idx on public.auctions(ends_at);

do $$
declare table_name text;
begin
  foreach table_name in array array['companies','profiles','demands','pools','quotes','auctions','orders','inventory_lots','shipments','inspections','allocations','settlements','disputes','action_queue','notifications']
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end;
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.demands enable row level security;
alter table public.pools enable row level security;
alter table public.quotes enable row level security;
alter table public.auctions enable row level security;
alter table public.orders enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.shipments enable row level security;
alter table public.inspections enable row level security;
alter table public.allocations enable row level security;
alter table public.settlements enable row level security;
alter table public.disputes enable row level security;
alter table public.action_queue enable row level security;
alter table public.notifications enable row level security;

-- The current app reads through its server API. Keep the public client locked down;
-- add role-aware policies alongside the Supabase Auth migration before direct browser reads.
