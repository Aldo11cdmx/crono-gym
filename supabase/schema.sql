-- Cronos — initial schema migration
-- Auth: email/password (Supabase Auth). Exercise catalog seeded one-time
-- server-side; the exercises table is read-only for authenticated users.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- exercises: immutable catalog of 1,324 exercises.
-- id matches the dataset id ("0001".."1713").
-- ---------------------------------------------------------------------------
create table public.exercises (
  id          text primary key,
  name        text not null,
  body_part   text not null,
  target      text not null,
  equipment   text not null,
  gif_url     text not null,
  instructions text[] not null default '{}'
);

create index idx_exercises_body_part on public.exercises (body_part);
create index idx_exercises_equipment on public.exercises (equipment);
create index idx_exercises_target on public.exercises (target);

-- ---------------------------------------------------------------------------
-- routines: user-created workout plans.
-- ---------------------------------------------------------------------------
create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  created_at  timestamptz not null default now(),
  -- Fase 7: the home dashboard's favourites card. See
  -- `supabase/migrations/20261003000000_routine_favorites.sql`.
  is_favorite boolean not null default false
);

create index idx_routines_user_id on public.routines (user_id);

-- Partial: the only query this serves is "my favorites", so the non-favorite rows
-- of every athlete belong in the table but not in this index.
create index idx_routines_user_favorites on public.routines (user_id)
  where is_favorite;

-- ---------------------------------------------------------------------------
-- routine_exercises: exercises within a routine, with target sets / rest.
-- ---------------------------------------------------------------------------
create table public.routine_exercises (
  id            uuid primary key default gen_random_uuid(),
  routine_id    uuid not null references public.routines (id) on delete cascade,
  exercise_id   text not null references public.exercises (id),
  target_sets   integer not null check (target_sets > 0),
  rest_seconds  integer not null default 0 check (rest_seconds >= 0),
  order_index   integer not null
);

create index idx_routine_exercises_routine_id on public.routine_exercises (routine_id);

-- ---------------------------------------------------------------------------
-- workout_logs: a single completed workout + Notion-style journal notes.
-- routine_id is optional (ad-hoc workouts).
-- ---------------------------------------------------------------------------
create table public.workout_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  routine_id    uuid references public.routines (id) on delete set null,
  started_at    timestamptz not null,
  completed_at  timestamptz,
  journal_notes text
);

create index idx_workout_logs_user_id on public.workout_logs (user_id);
create index idx_workout_logs_started_at on public.workout_logs (started_at desc);

-- ---------------------------------------------------------------------------
-- completed_sets: individual sets logged for an exercise within a workout.
-- ---------------------------------------------------------------------------
create table public.completed_sets (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  set_number integer not null check (set_number > 0),
  weight     numeric,
  reps       integer,
  rpe        numeric,
  is_warmup  boolean not null default false,
  notes      text
);

create index idx_completed_sets_log_id on public.completed_sets (log_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- exercises is a global, read-only catalog for authenticated users.
-- ---------------------------------------------------------------------------
alter table public.exercises enable row level security;

create policy "exercises_select_authenticated"
  on public.exercises
  for select
  to authenticated
  using (true);

-- User-owned data is scoped to the caller.
alter table public.routines enable row level security;

create policy "routines_crud_own"
  on public.routines
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.routine_exercises enable row level security;

create policy "routine_exercises_crud_own"
  on public.routine_exercises
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.routines r
      where r.id = public.routine_exercises.routine_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.routines r
      where r.id = public.routine_exercises.routine_id
        and r.user_id = auth.uid()
    )
  );

alter table public.workout_logs enable row level security;

create policy "workout_logs_crud_own"
  on public.workout_logs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.completed_sets enable row level security;

create policy "completed_sets_crud_own"
  on public.completed_sets
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.workout_logs wl
      where wl.id = public.completed_sets.log_id
        and wl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_logs wl
      where wl.id = public.completed_sets.log_id
        and wl.user_id = auth.uid()
    )
  );