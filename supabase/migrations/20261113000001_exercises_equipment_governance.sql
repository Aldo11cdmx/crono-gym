-- exercises: the governance columns a coach edits from the portal.
--
-- The shipped catalog lives in the app bundle; this table is what a coach can
-- change without a redeploy. Until now it held only the display columns, so a
-- machine assignment, a station or the availability flag had nowhere to go and
-- the portal could only rename.
--
-- Additive only: every column is nullable or defaulted, so an offline client
-- running the previous build keeps working (it selects a subset of columns, and
-- an absent column is simply not requested). The rollback drops what this
-- migration added; it never removes rows.

alter table public.exercises
  add column if not exists equipment_id text,
  add column if not exists equipment_name text,
  add column if not exists station_key text,
  add column if not exists movement_pattern text,
  add column if not exists available_in_cronos_gym boolean not null default true,
  add column if not exists image text,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.exercises.equipment_id is
  'Machine code from the local equipment map (CG-EQP-####), or NONE for bodyweight work.';
comment on column public.exercises.station_key is
  'Functional station the movement needs; unavailable_station means the gym cannot host it.';
comment on column public.exercises.available_in_cronos_gym is
  'Coach override for whether this gym can run the exercise.';

-- The columns a coach may read.
grant select on public.exercises to authenticated;

-- updated_at moves with the row, whoever writes it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists exercises_touch_updated_at on public.exercises;
create trigger exercises_touch_updated_at
  before update on public.exercises
  for each row
  execute function public.touch_updated_at();

-- Governance writes belong to coaches, admins and developers.
drop policy if exists "exercises_insert_coach" on public.exercises;
create policy "exercises_insert_coach"
  on public.exercises
  for insert
  to authenticated
  with check (
    public.has_role('coach'::public.app_role)
    or public.has_role('admin'::public.app_role)
    or public.has_role('developer'::public.app_role)
  );

drop policy if exists "exercises_update_coach" on public.exercises;
create policy "exercises_update_coach"
  on public.exercises
  for update
  to authenticated
  using (
    public.has_role('coach'::public.app_role)
    or public.has_role('admin'::public.app_role)
    or public.has_role('developer'::public.app_role)
  )
  with check (
    public.has_role('coach'::public.app_role)
    or public.has_role('admin'::public.app_role)
    or public.has_role('developer'::public.app_role)
  );

-- The catalog list is ordered by name and filtered by muscle; the governance
-- columns are read for the same rows.
create index if not exists idx_exercises_equipment_id on public.exercises (equipment_id);
create index if not exists idx_exercises_movement_pattern on public.exercises (movement_pattern);