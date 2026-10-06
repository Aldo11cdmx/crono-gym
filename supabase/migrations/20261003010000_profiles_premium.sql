-- Cronos — premium entitlements on the athlete's own profile.
--
-- Three columns, one question: does this athlete have the paid tier right now?
-- Split into a flag and a date rather than a single boolean because "premium" and
-- "premium until" are different products -- a perpetual tier is `is_premium = true`
-- with a null expiry, and an expiring subscription has a date. Collapsing them
-- would make one of the two unrepresentable.
--
-- Idempotent: `add column if not exists` throughout, so applying this to a database
-- that already has them is a no-op.

-- ---------------------------------------------------------------------------
-- is_premium
--
-- `default false` rather than `null`: "does this athlete have premium" has no third
-- answer, and a nullable boolean would push a coalesce into every reader of a state
-- the database should refuse to store. The default backfills every existing row
-- without a separate UPDATE, so the whole change is three statements that cannot
-- half-apply -- there is no window in which some athletes are premium and the
-- application does not yet know it.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_premium boolean not null default false;

-- ---------------------------------------------------------------------------
-- premium_since / premium_expires_at
--
-- Both nullable on purpose, and they are not the same nullability question.
--
--   `premium_since` null with `is_premium = false` is meaningful: an athlete who
--   never subscribed. For a current subscriber it should be set, which the CHECK
--   below enforces rather than trusting.
--
--   `premium_expires_at` null with `is_premium = true` is meaningful and
--   load-bearing: it is how a perpetual tier is represented. Expiry is therefore
--   never defaulted and never backfilled -- a migration that stamped every
--   existing row with an expiry date would quietly expire every current subscriber
--   on the day the field was introduced.
--
-- Both are timestamptz because an entitlement boundary is an instant, not a date.
-- An athlete's premium lapsing "on 2026-11-01" is 00:00 UTC on that day, and a
-- timestamp is the only thing that can say so unambiguously in every timezone.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists premium_since timestamptz;

alter table public.profiles
  add column if not exists premium_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- Entitlement consistency.
--
-- Two contradictions are refused at write time because both are reachable by an
-- ordinary UPDATE and neither is a state the application should ever have to
-- interpret:
--
--   - an expiry that precedes the start of the tier, and
--   - a subscriber with no start date.
--
-- A non-premium athlete *may* carry an expiry date. That is the natural shape of a
-- lapsed subscription, and forcing it to null would mean a downgrade had to erase
-- history it is supposed to keep.
--
-- `drop constraint if exists` first so the file stays re-runnable against a
-- database where an earlier version of this CHECK was tightened.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_premium_window_check;

alter table public.profiles
  add constraint profiles_premium_window_check
  check (
    (premium_since is null or premium_expires_at is null
      or premium_expires_at > premium_since)
    and (is_premium = false or premium_since is not null)
  );

-- ---------------------------------------------------------------------------
-- The columns the athlete may not write.
--
-- Without this the paywall is decorative. `profiles_crud_own` is `for all` scoped to
-- `auth.uid() = user_id`, and `authenticated` holds table-level UPDATE on
-- `profiles` (Supabase's default grant), so an athlete could run
--
--     update profiles set is_premium = true where user_id = auth.uid()
--
-- and the RLS policy would permit it: it *is* their own row. No row-level policy can
-- fix this, because RLS decides which rows a statement may touch and this statement
-- only ever wanted one row it already owns. The gate has to be at the column.
--
-- So the table-level UPDATE is revoked and re-granted per column, naming every
-- column the app legitimately writes. `is_premium`, `premium_since` and
-- `premium_expires_at` are then absent from the grant, and an attempt to set them
-- fails with "permission denied for table profiles" before RLS is even consulted.
--
-- SELECT is untouched on purpose: `authenticated` keeps its table-level grant, and
-- the athlete must be able to *read* their own entitlement -- that read is what gates
-- the UI. Only the write path is narrowed. Entitlement writes happen through the
-- service role, which keeps its table-level grant and bypasses RLS entirely.
--
-- The grant list is exhaustive and duplicated nowhere else in the codebase: adding a
-- profile field means adding it here too, or the athlete gets
-- "permission denied" on a field they are entitled to change. That is the trade --
-- one forgotten column is a loud, immediate failure rather than a silent hole.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;

grant update (
  display_name,
  birth_date,
  sex,
  height_cm,
  weight_kg,
  unit_system,
  experience_level,
  activity_level,
  goal,
  guardian_consent_at,
  onboarding_completed_at,
  updated_at
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Not indexed.
--
-- Every query that reads `is_premium` filters by `user_id` first, and `user_id` is
-- the primary key, so each such query already touches exactly one row through the
-- PK index. An index on the flag alone would only be used by a query that scans
-- every athlete in the product -- which no RLS-scoped client can write, and which
-- would be a paid-athlete list if it could.