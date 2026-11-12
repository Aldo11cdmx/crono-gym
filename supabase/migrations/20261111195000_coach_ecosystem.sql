-- Coach ecosystem contracts used by the reactive Coach/athlete/admin surfaces.
create table if not exists public.coach_offers (
  coach_id uuid primary key references auth.users(id) on delete cascade,
  price_mxn numeric not null default 450 check (price_mxn >= 0),
  specialty text not null default '',
  shift text not null default '',
  billing_cycle text not null default 'mensual' check (billing_cycle in ('mensual', 'por_rutina', 'trimestral')),
  benefits jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coach_offers enable row level security;
drop policy if exists coach_offers_owner on public.coach_offers;
create policy coach_offers_owner on public.coach_offers
  for all to authenticated
  using (coach_id = auth.uid() or public.has_role('admin'::public.app_role) or public.has_role('developer'::public.app_role))
  with check (coach_id = auth.uid() or public.has_role('admin'::public.app_role) or public.has_role('developer'::public.app_role));

alter table public.coach_session_requests
  drop constraint if exists coach_session_requests_status_check;
alter table public.coach_session_requests
  add constraint coach_session_requests_status_check
  check (status in ('pending', 'pending_cash_payment', 'active', 'declined', 'closed', 'cancelled'));

create table if not exists public.coach_exercise_requests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  body_part text not null default '',
  equipment text not null default '',
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now()
);

alter table public.coach_exercise_requests enable row level security;
drop policy if exists coach_exercise_requests_owner on public.coach_exercise_requests;
create policy coach_exercise_requests_owner on public.coach_exercise_requests
  for all to authenticated
  using (coach_id = auth.uid() or public.has_role('admin'::public.app_role) or public.has_role('developer'::public.app_role))
  with check (coach_id = auth.uid());

create index if not exists idx_coach_exercise_requests_status
  on public.coach_exercise_requests(status, created_at desc);
