-- Cronos — Fase 7 · favorite routines
-- Aplicar: supabase db push
--
-- `is_favorite` is a flag on the athlete's own routine, not a separate table: a
-- favorite *is* a routine, so a join table would have to be kept consistent with
-- the routine row for no gain. The home dashboard reads this column directly.

-- ---------------------------------------------------------------------------
-- routines.is_favorite
--
-- `not null default false` rather than nullable: "is this a favorite" has no
-- third answer, and a nullable boolean makes every reader carry a coalesce for a
-- state the database should refuse to store. The default backfills existing rows
-- without a separate UPDATE, so the migration is a single statement that cannot
-- half-apply.
-- ---------------------------------------------------------------------------
alter table public.routines
  add column if not exists is_favorite boolean not null default false;

-- ---------------------------------------------------------------------------
-- Partial index.
--
-- The only query this column serves is "my favorites", always scoped to one user.
-- A plain `(user_id, is_favorite)` index would also carry every non-favorite row
-- of every athlete, which is the majority of the table and of no use to this
-- query. The `where` clause keeps only the flagged rows, so the index stays small
-- and -- more importantly -- stays useful: a boolean has two values, and Postgres
-- will not use a b-tree on it to answer "which rows are true" efficiently unless
-- the partial predicate matches.
-- ---------------------------------------------------------------------------
create index if not exists idx_routines_user_favorites
  on public.routines (user_id)
  where is_favorite;

-- ---------------------------------------------------------------------------
-- Ordering for the favorites card.
--
-- The home card shows the athlete's favorites newest-first, matching the order
-- `useRoutines` already sorts the full catalogue by. Without this the sort is a
-- filesort over the matched set; with it, the index answers the order as well as
-- the filter.
-- ---------------------------------------------------------------------------
create index if not exists idx_routines_user_favorites_created
  on public.routines (user_id, created_at desc)
  where is_favorite;

-- ---------------------------------------------------------------------------
-- RLS is deliberately not touched.
--
-- `routines_crud_own` is `for all`, so it already covers the new column: the
-- athlete can read and write their own favorite flag, and nobody else's. Adding
-- a second policy for one column of an existing table would not narrow anything
-- -- RLS is permissive by union -- so a new policy here could only ever widen
-- access.
--