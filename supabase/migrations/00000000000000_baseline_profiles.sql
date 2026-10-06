-- Cronos — baseline · profiles
--
-- `profiles` predates version-controlled schema: it was created straight on the
-- database and `supabase/schema.sql` never grew it, so a fresh `supabase db push`
-- produced an app with no `profiles` table and every profile-dependent query
-- failing. This migration closes that gap by snapshotting the table as it exists
-- in production.
--
-- Applying it to production is a no-op. Every statement is guarded: the table by
-- `if not exists`, the policy by `drop ... if exists` first. Nothing here alters a
-- row, renames a column, or tightens a constraint that is already in place.
--
-- Faithful to the live table, which is the only definition that matters: the
-- column set, the numeric precision, the defaults, the CHECK constraints, the
-- cascade to `auth.users` and the single `for all` policy are copied verbatim from
-- `information_schema` / `pg_constraint` / `pg_policy`.
--
-- Deliberately NOT recreated here: `touch_updated_at()`, `enforce_minor_guard()`
-- and their triggers, plus the sign-up trigger on `auth.users`. Those live outside
-- version control with no source of truth to copy, and a plausible
-- reimplementation would be a guess that could differ from what production does.
-- This file is a snapshot of the table, not a rebuild of the profile subsystem.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, keyed by user_id.
--
-- `user_id` is both the primary key and the foreign key, so there is exactly one
-- profile per account and deleting the account deletes the profile. An athlete's
-- profile is their identity across every feature that reads it -- the rank engine,
-- the coach context, the calorie targets -- so it is keyed by the auth id rather
-- than by a surrogate that would need its own uniqueness rule.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id                uuid primary key references auth.users (id) on delete cascade,

  -- Identity and physiology. Nullable throughout: onboarding collects these in
  -- stages, and a profile that cannot exist until it is complete is a profile that
  -- cannot be created.
  display_name           text,
  birth_date             date check (birth_date <= current_date),
  sex                    text check (sex in ('male', 'female', 'other')),
  height_cm              numeric(5,1) check (height_cm between 100 and 250),
  weight_kg              numeric(5,2) check (weight_kg between 25 and 400),

  -- Preferences and training context. `not null` with a default rather than
  -- nullable: these are enums, and an athlete who has not chosen has still been
  -- given one by the default. Nullable would only spread the coalesce to every
  -- reader. The CHECK lists are the app's own unions in
  -- `src/lib/profile.ts`; the database is where they are enforced rather than
  -- assumed.
  unit_system            text    not null default 'metric'
                                 check (unit_system in ('metric', 'imperial')),
  experience_level       text    not null default 'beginner'
                                 check (experience_level in ('beginner', 'intermediate', 'advanced')),
  activity_level         text    not null default 'moderate'
                                 check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'athlete')),
  goal                   text    not null default 'maintain'
                                 check (goal in ('lose_weight', 'maintain', 'gain_muscle', 'strength', 'endurance')),

  -- Consent and completion stamps. Both are facts about a moment, so both are
  -- timestamptz and both are null until they happen -- unlike the preferences
  -- above, "has not consented yet" is a third state that must be distinguishable
  -- from "consented to something".
  guardian_consent_at    timestamptz,
  onboarding_completed_at timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-Level Security.
--
-- One `for all` policy on the caller's own row, mirroring the pattern every other
-- table in this schema uses. The athlete may read and write their own profile and
-- nobody else's -- including the premium columns added in the next migration,
-- which are covered by this policy automatically.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_crud_own on public.profiles;

create policy profiles_crud_own
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);