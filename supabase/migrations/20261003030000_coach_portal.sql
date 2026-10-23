-- ---------------------------------------------------------------------------
-- 20261003030000_coach_portal.sql
--
-- The third half of the human coach: what the coach's own screen needs.
--
-- The previous migration built the join between an athlete and a coach and left the
-- coach unable to do anything with it. `20261003020000_coach_human.sql:397-401` says so
-- in as many words and names the fix:
--
--   "A coach writing a routine *for* an athlete needs an insert policy. It cannot be
--    written before `coach_session_requests` exists [...] So the policy lands in the
--    migration that follows, once both sides exist."
--
-- This is that migration. It closes five gaps, all of which are the same gap seen from
-- different sides: **a coach could be handed a list of athletes and then be unable to
-- look at any of them.**
--
--   1. `coaches.is_available` -- the coach's own switch, and the only column on this
--      table a client may write.
--   2. Coach-scoped reads of an athlete's training data, qualified by an *active*
--      request.
--   3. Coach writes of `routines` and `routine_exercises` for that athlete.
--   4. `routines.authored_by_coach`, so a failed write can be cleaned up by its author.
--   5. `routine_exercises` learns about days and rep ranges, which the schema has never
--      had and both routine writers have been discarding.
--
-- The qualification in (2) and (3) is the whole design, so it is stated once here and
-- repeated verbatim below: a coach may read an athlete's data only while there exists a
-- request from *that* athlete to *that* coach with `status = 'active'`. Not `pending`:
-- before accepting, the coach sees the notes the athlete wrote, which
-- `coach_session_requests` already permits, and nothing else. Not `declined` or `closed`:
-- the working relationship is over and so is the access.
--
-- Every predicate qualifies through `c.user_id = auth.uid()` and never through a
-- `coach_id` supplied by the caller. A client that could name its own coach id would
-- name someone else's, and the whole policy would be a self-service directory.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. coaches.is_available
--
-- Distinct from `is_active`, which means "this coach is on the staff roster and athletes
-- may see them". Folding the two together would make "I'm taking a break" mean "I no
-- longer work here", and there is no way back from the second without a service-role
-- write. Two facts about a person, two columns.
--
-- Defaults to true: a row can only be created by the service role, so nobody becomes
-- unreachable by omission.
-- ---------------------------------------------------------------------------
alter table public.coaches
  add column if not exists is_available boolean not null default true;

comment on column public.coaches.is_available is
  'Whether this coach is currently accepting new session requests. Independent of '
  'is_active, which is membership of the roster rather than availability today.';

-- ---------------------------------------------------------------------------
-- 2. Column-level privileges on `coaches`.
--
-- RLS is row-level. It cannot tell *which* column a coach is writing, so a policy of
-- `for update using (auth.uid() = user_id)` would happily let a coach rewrite their own
-- `pin_hash` or clear their own `is_provisional` -- both of which are the two columns
-- `coach-auth` exists to protect. Revoking the table privilege and re-granting one
-- column is what makes "this coach may only flip this switch" true rather than intended.
--
-- The same pattern, and the same trade, is already set on `profiles` in
-- `20261003010000_profiles_premium.sql:106-121`: a forgotten column is a loud
-- "permission denied" rather than a silent hole.
--
-- Nothing legitimate loses access. `coach-auth` writes through the service role, which
-- bypasses both RLS and these grants, and no client anywhere in the repository issues an
-- UPDATE against `coaches`.
-- ---------------------------------------------------------------------------
revoke update on public.coaches from authenticated;

grant update (is_available) on public.coaches to authenticated;

drop policy if exists "coaches can update own availability" on public.coaches;

create policy "coaches can update own availability"
  on public.coaches
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Reading an athlete, from the coach's side.
--
-- Five policies, one predicate, spelled out each time. Not factored into a helper
-- function: `security definer` would have to be careful about `search_path`, and the
-- alternative -- a function returning a boolean that every policy calls -- trades a
-- duplicated six-line predicate for a dependency every future migration has to
-- understand. Repetition is the cheaper failure mode here, and `supabase_get_advisors`
-- reads each policy on its own.
--
-- All five are `for select` only. The existing `for all` policies on these tables keep
-- their own commands: RLS unions across policies per command, so a coach gains SELECT and
-- nothing else. That is why the writes below are separate policies rather than one
-- `for all`.
-- ---------------------------------------------------------------------------

-- workout_logs: the athlete's sessions, and the spine every other read hangs off.
drop policy if exists "coaches can read assigned athletes' logs" on public.workout_logs;

create policy "coaches can read assigned athletes' logs"
  on public.workout_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_session_requests r
      join public.coaches c on c.id = r.coach_id
      where r.athlete_id = workout_logs.user_id
        and c.user_id = auth.uid()
        and r.status = 'active'
    )
  );

-- completed_sets has no `user_id` of its own -- it is scoped by `log_id` -- so the
-- qualification has to go through the session that owns the set. The subquery is the
-- same one `workout_logs_crud_own` already uses, with the coach test added.
--
-- Identical shape to the `workout_logs` policy above, deliberately: the two are read
-- together, and an asymmetry between them -- a condition present on one and not the other
-- -- is the kind of thing that gets half-copied into the next policy written from this
-- file.
drop policy if exists "coaches can read assigned athletes' sets" on public.completed_sets;

create policy "coaches can read assigned athletes' sets"
  on public.completed_sets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_logs wl
      where wl.id = completed_sets.log_id
        and exists (
          select 1
          from public.coach_session_requests r
          join public.coaches c on c.id = r.coach_id
          where r.athlete_id = wl.user_id
            and c.user_id = auth.uid()
            and r.status = 'active'
        )
    )
  );

-- profiles: bodyweight and sex, which the rank maths needs and cannot proceed without.
-- The same two columns `useMuscleRanks` reads for the athlete themselves
-- (`src/hooks/useMuscleRanks.ts:273`).
drop policy if exists "coaches can read assigned athletes' profiles" on public.profiles;

create policy "coaches can read assigned athletes' profiles"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_session_requests r
      join public.coaches c on c.id = r.coach_id
      where r.athlete_id = profiles.user_id
        and c.user_id = auth.uid()
        and r.status = 'active'
    )
  );

-- routines: what this athlete has been prescribed before, which is the history a coach
-- needs before prescribing again.
drop policy if exists "coaches can read assigned athletes' routines" on public.routines;

create policy "coaches can read assigned athletes' routines"
  on public.routines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_session_requests r
      join public.coaches c on c.id = r.coach_id
      where r.athlete_id = routines.user_id
        and c.user_id = auth.uid()
        and r.status = 'active'
    )
  );

-- routine_exercises: the contents of those routines.
drop policy if exists "coaches can read assigned athletes' routine exercises"
  on public.routine_exercises;

create policy "coaches can read assigned athletes' routine exercises"
  on public.routine_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.routines rt
      where rt.id = routine_exercises.routine_id
        and exists (
          select 1
          from public.coach_session_requests r
          join public.coaches c on c.id = r.coach_id
          where r.athlete_id = rt.user_id
            and c.user_id = auth.uid()
            and r.status = 'active'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Authoring: the coach writes the routine, the athlete owns the row.
--
-- `routines.user_id` stays the athlete's, which is what makes the row appear in their
-- library, their history and their own delete button. There is no "coach-owned routine"
-- branch in any read path in the app and this migration does not introduce one.
--
-- `authored_by_coach` records who wrote it, for two reasons. It is the only way the
-- athlete can be told "your coach wrote this" rather than "this routine exists", which
-- is the entire point of `routines.source = 'human_coach'`. And it is what lets the
-- DELETE policy below be narrow: without it, "a coach may remove a routine" would have
-- to mean "may remove any routine this athlete has, including the ones they wrote", which
-- is not a trade anybody would accept for a failed-write cleanup.
--
-- Null for every existing row and for everything an athlete creates. `on delete set null`
-- rather than `cascade`: retiring a coach is `is_active = false` and never a delete, but
-- if the row ever does go, the athlete must not lose their programme with it.
-- ---------------------------------------------------------------------------
alter table public.routines
  add column if not exists authored_by_coach uuid
    references public.coaches (id) on delete set null;

comment on column public.routines.authored_by_coach is
  'The coach who wrote this routine, when a human coach did. Null for routines the '
  'athlete or the AI created. Lets the athlete see who prescribed it, and lets a coach '
  'remove exactly the rows they authored.';

-- Not indexed. Every read filters by `user_id` first, which `idx_routines_user_id`
-- already answers with a single row set; an index here would only ever be chosen by a
-- query that scans one coach's authored work, which is the cleanup path and runs once.

drop policy if exists "coaches can insert assigned athletes' routines" on public.routines;

create policy "coaches can insert assigned athletes' routines"
  on public.routines
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.coach_session_requests r
      join public.coaches c on c.id = r.coach_id
      where r.athlete_id = routines.user_id
        and c.user_id = auth.uid()
        and r.status = 'active'
    )
  );

-- Narrow on purpose: this exists for the compensating delete that
-- `saveGeneratedRoutine` performs when the second insert fails, and a coach removing a
-- programme their athlete has been following is a different act with a different
-- consent story. `authored_by_coach` is the coach's own row, so this cannot reach a
-- routine written by somebody else, by the athlete, or by the model.
drop policy if exists "coaches can delete their own authored routines" on public.routines;

create policy "coaches can delete their own authored routines"
  on public.routines
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.coaches c
      where c.id = routines.authored_by_coach
        and c.user_id = auth.uid()
    )
  );

-- The exercises inside that routine. Same qualification, reached through the parent,
-- because `routine_exercises` has no `user_id` to test against.
--
-- INSERT only. There is no DELETE policy here on purpose: when the routine row goes, the
-- foreign key's `on delete cascade` takes the exercises with it, so the cleanup path needs
-- exactly one delete and it is the one above.
drop policy if exists "coaches can insert their own routine exercises"
  on public.routine_exercises;

create policy "coaches can insert their own routine exercises"
  on public.routine_exercises
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.routines rt
      where rt.id = routine_exercises.routine_id
        and exists (
          select 1
          from public.coaches c
          where c.id = rt.authored_by_coach
            and c.user_id = auth.uid()
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. routine_exercises learns about days and reps.
--
-- The column has always been `order_index`, an integer counting across the *whole*
-- routine, so a four-day programme was stored as one flat list and the day grouping was
-- a property of whoever generated it rather than of the data. Both writers threw it
-- away: `saveGeneratedRoutine.ts:55-61` documents it as a TODO, and the coach's own
-- builder could not have stored a day name at all.
--
-- Adding the columns retires that TODO for the AI path as a side effect. `GeneratedDay`
-- already carries `dayNumber` and `focus`, and `GeneratedExercise` already carries
-- `repsMin` and `repsMax` (`src/lib/ai/routineGenerator.ts:64-76`) -- every one of them
-- validated, and every one of them discarded on save.
--
-- `order_index` is left alone rather than re-based to count within the day. Changing its
-- meaning would invalidate every row already stored, and readers of an existing routine
-- would have to guess which convention they were looking at. Counting within the day
-- instead, which is what a reader wants to see, is what `day_index` provides.
--
-- Nullable rather than `not null` on the reps: an existing row has no rep target, and
-- inventing a default of 10 would be a number nobody chose. `null` reads as "unspecified",
-- which is the truth. The CHECK allows null deliberately -- as with `source` at
-- `20261003020000_coach_human.sql:388-391`, a bare `> 0` would reject the nulls and
-- defeat the default.
-- ---------------------------------------------------------------------------
alter table public.routine_exercises
  add column if not exists day_index integer not null default 0,
  add column if not exists day_label text not null default '',
  add column if not exists target_reps_min integer,
  add column if not exists target_reps_max integer;

alter table public.routine_exercises
  drop constraint if exists routine_exercises_day_index_check;

alter table public.routine_exercises
  add constraint routine_exercises_day_index_check check (day_index >= 0);

alter table public.routine_exercises
  drop constraint if exists routine_exercises_reps_min_check;

alter table public.routine_exercises
  add constraint routine_exercises_reps_min_check
  check (target_reps_min is null or target_reps_min > 0);

alter table public.routine_exercises
  drop constraint if exists routine_exercises_reps_max_check;

alter table public.routine_exercises
  add constraint routine_exercises_reps_max_check
  check (target_reps_max is null or target_reps_max > 0);

-- Replaces `idx_routine_exercises_routine_id`, which answered "every exercise in this
-- routine" with the rows already in insertion order. The new key answers the same query
-- *and* "every exercise in this routine grouped by day, in order", which is how both
-- writers will read it back. Leading with `routine_id` keeps it usable as the primary
-- lookup, so this is a widening of what one index answers rather than a replacement.
drop index if exists public.idx_routine_exercises_routine_id;

create index if not exists idx_routine_exercises_routine_day
  on public.routine_exercises (routine_id, day_index, order_index);

-- ---------------------------------------------------------------------------
-- 6. The queue's index.
--
-- The portal's first query is "my requests that are still open", which filters on
-- `coach_id` and `status` and orders by `created_at desc`. The existing index
-- (`20261003020000_coach_human.sql:162-163`) leads with `coach_id` and then jumps to
-- `created_at`, so the `status` filter is a filter rather than part of the key, and a
-- coach with a long history keeps scanning declined and closed rows to find the two that
-- are live.
--
-- Partial rather than a `(coach_id, status, created_at)` composite: the statuses this
-- index serves are exactly two, the set never grows, and every closed request stops being
-- indexed the moment it closes. A full index would keep growing with the archive; this
-- one stays the size of the coach's working set.
-- ---------------------------------------------------------------------------
create index if not exists idx_coach_requests_queue
  on public.coach_session_requests (coach_id, created_at desc)
  where status in ('pending', 'active');

-- ---------------------------------------------------------------------------
-- 7. What the linter says about all of the above, and what was decided.
--
-- Recorded here because `supabase_get_advisors` will keep reporting these on every
-- run, and a lint that is re-reported forever without a recorded decision is worse than
-- one that is accepted.
--
-- **`auth_rls_initplan` (WARN), six times, one for each policy added above.** The fix is
-- to write `(select auth.uid())` so the planner evaluates the setting once per statement
-- instead of once per row. Not applied here, deliberately: `auth.uid()` is wrapped in a
-- subquery the same number of times in this file as in the fifteen policies that already
-- shipped -- `profiles_crud_own`, `workout_logs_crud_own`, `coaches can read own row` and
-- the rest -- and `20261003010000_profiles_premium.sql` accepted the same lint for the
-- same reason. Rewriting six of twenty-one leaves the table in a state where a reader
-- cannot tell which convention a policy follows, and it is a pure optimisation with no
-- semantic difference. It wants to be one sweep over every policy in the schema, not half
-- of one migration.
--
-- **`multiple_permissive_policies` (WARN), on all five read tables.** Inherent to the
-- design rather than an oversight: the athlete's `for all` policy is still there and a
-- coach's `for select` policy is added beside it, so every athlete read evaluates both.
-- Postgres unions permissive policies per command and there is no "only run this one if
-- you are a coach" without splitting the athlete policy into four command-specific ones,
-- which is a larger change to code this migration does not own. The cost is one extra
-- subquery on a read that already filters on `user_id`.
--
-- **`unindexed_foreign_keys` (INFO) on `routines_authored_by_coach_fkey`.** Answered at
-- the comment above the column and not fixed: the linter cannot know that the only query
-- which would use such an index is the compensating delete, which runs once and only when
-- something has already gone wrong.
--
-- **`unused_index` (INFO) on `idx_routine_exercises_routine_day`.** Expected -- the index
-- was created minutes ago and the code that reads by day has not been written yet. It
-- becomes used in the same change that writes `day_index`.
-- ---------------------------------------------------------------------------