-- Gym Store
do $$
begin
  create type public.product_category as enum ('supplements','accessories','clothing','other');
exception when duplicate_object then null;
end
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  category public.product_category not null default 'other',
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists products_read_active on public.products;
create policy products_read_active on public.products
  for select to authenticated using (is_active = true);

drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all to authenticated using (public.has_role('admin'))
  with check (public.has_role('admin'));


-- Purchase tickets
do $$
begin
  create type public.purchase_ticket_status as enum ('pending','paid','delivered','cancelled');
exception when duplicate_object then null;
end
$$;

create table if not exists public.purchase_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  status public.purchase_ticket_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.purchase_tickets enable row level security;

drop policy if exists purchase_tickets_read_own on public.purchase_tickets;
create policy purchase_tickets_read_own on public.purchase_tickets
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists purchase_tickets_insert_own on public.purchase_tickets;
create policy purchase_tickets_insert_own on public.purchase_tickets
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists purchase_tickets_admin_all on public.purchase_tickets;
create policy purchase_tickets_admin_all on public.purchase_tickets
  for all to authenticated using (public.has_role('admin'))
  with check (public.has_role('admin'));

create or replace function public.purchase_tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price integer;
  v_active boolean;
begin
  select price_cents, is_active into v_price, v_active
  from public.products where id = new.product_id;

  if v_price is null or not v_active then
    raise exception 'product_unavailable';
  end if;

  if not public.has_role('admin') then
    new.unit_price_cents := v_price;
    new.total_cents := v_price * new.quantity;
    new.status := 'pending';
  end if;
  return new;
end;
$$;

revoke execute on function public.purchase_tickets_before_insert() from public, anon, authenticated;

drop trigger if exists purchase_tickets_before_insert on public.purchase_tickets;
create trigger purchase_tickets_before_insert
  before insert on public.purchase_tickets
  for each row execute function public.purchase_tickets_before_insert();


-- Gym Classes & Schedules
create table if not exists public.gym_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  instructor text,
  capacity integer not null default 20 check (capacity > 0),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gym_classes enable row level security;

drop policy if exists gym_classes_read_active on public.gym_classes;
create policy gym_classes_read_active on public.gym_classes
  for select to authenticated using (is_active = true);

drop policy if exists gym_classes_admin_all on public.gym_classes;
create policy gym_classes_admin_all on public.gym_classes
  for all to authenticated using (public.has_role('admin'))
  with check (public.has_role('admin'));

create table if not exists public.gym_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.gym_classes(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  created_at timestamptz not null default now(),
  unique(class_id, day_of_week, start_time)
);

alter table public.gym_schedules enable row level security;

drop policy if exists gym_schedules_read on public.gym_schedules;
create policy gym_schedules_read on public.gym_schedules
  for select to authenticated using (true);

drop policy if exists gym_schedules_admin_all on public.gym_schedules;
create policy gym_schedules_admin_all on public.gym_schedules
  for all to authenticated using (public.has_role('admin'))
  with check (public.has_role('admin'));

