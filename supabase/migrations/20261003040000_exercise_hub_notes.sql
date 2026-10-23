-- ---------------------------------------------------------------------------
-- 20261003040000_exercise_hub_notes.sql
--
-- The data the exercise hub reads: per-set notes, and the index its history
-- query actually needs.
--
-- Two things are asked for here and only one of them is new.
--
--   1. `completed_sets.notes` -- genuinely new. Free text an athlete writes about
--      one set: "the grip gave out at rep 7", "elbow hurt, drop the weight next
--      time". Nothing in the schema had anywhere to put it.
--
--   2. `completed_sets.is_warmup` -- **already exists**. `schema.sql:87` declares
--      it `boolean not null default false`, the types in `src/types/supabase.ts`
--      carry it on all three of Row/Insert/Update, and
--      `src/hooks/useAthletePRs.ts:118` already filters on it. The brief asked for
--      it as if it were missing; re-adding it here would either be a no-op or, if
--      written as `add column`, an error on a database that has it. It is left
--      alone on purpose. If a deployed environment is missing it, that is a
--      drift between environments and `supabase db push` will say so; the fix
--      belongs in a repair migration naming the real state, not in one that
--      assumes it.
--
-- On `notes` living here rather than on `exercises`
-- ---------------------------------------------
-- A note about "sentillas" is about a sentadilla on a particular day at a
-- particular weight. An athlete who stops being able to do an exercise and comes
-- back months later needs to read what made it stop *that time*, not the last
-- thing anyone typed into a shared field -- and a per-exercise field would be
-- overwritten by the newest attempt, destroying the record that makes the
-- history worth reading. So: one note per set, next to the weight and reps it
-- describes, and the hub reads them in the same query as the numbers.
--
-- `text` and nullable, not `not null default ''`. An empty string and "no note"
-- are different, and only one of them is a decision anyone made; collapsing them
-- would make "I wrote nothing" indistinguishable from "I wrote something that
-- happened to be blank", which matters when the hub later highlights noted sets.
--
-- `check (length(notes) <= 2000)`
-- -------------------------------
-- A bound, because a `text` column on the hot logging path is an unbounded write
-- from an app that also works offline: a queued set carrying a pasted article
-- would sync on a phone's metered connection and quietly cost the athlete money.
-- 2000 characters is roughly 300 words, well past anything anyone writes about one
-- set, and the app enforces the same number before writing so the check is a
-- backstop rather than the primary limit. `char_length` rather than `length` is
-- deliberate: `length` on `text` counts characters in Postgres too, but naming it
-- explicitly is what stops someone "fixing" it to `octet_length` later and
-- making the bound four times looser than intended.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. completed_sets.notes
-- ---------------------------------------------------------------------------
alter table public.completed_sets
  add column if not exists notes text;

comment on column public.completed_sets.notes is
  'Free text the athlete wrote about this set. Null means no note, which is not the same as an empty note.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'completed_sets_notes_length'
      and conrelid = 'public.completed_sets'::regclass
  ) then
    alter table public.completed_sets
      add constraint completed_sets_notes_length
      check (notes is null or char_length(notes) <= 2000);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. The index the exercise hub's history query needs.
--
-- `completed_sets` has had exactly one index since `schema.sql:90`: `log_id`.
-- Every read of this table that is not "the sets in this log" is therefore a
-- sequential scan, and the hub's entire premise is "every set you have ever
-- logged for this one exercise".
--
-- `exercise_id` alone is the index, and not a composite of `(exercise_id,
-- started_at)`: `started_at` lives on `workout_logs`, so it cannot be part of an
-- index on this table without the planner denormalising the join into the index --
-- which is a different, much larger design decision, and one to make if the query
-- plan says it is needed rather than in advance.
--
-- Partial, on `is_warmup = false`, because that is the filter the hub applies.
-- A warm-up set is a smaller share of the table than the working sets, so the
-- partial index is both smaller and faster for exactly the query that matters.
-- The cost is that a query *without* the filter cannot use it -- which is the
-- right trade, since the only such query is `useAthletePRs.ts`, and that one
-- filters on `is_warmup = false` too.
--
-- `text` is hashable in Postgres, so a btree on `exercise_id` is a plain index.
-- It is not a bigint for a reason that has not changed: the catalog is addressed
-- by slug, and those are strings.
-- ---------------------------------------------------------------------------
create index if not exists idx_completed_sets_exercise_id
  on public.completed_sets (exercise_id)
  where is_warmup = false;

-- ---------------------------------------------------------------------------
-- 3. RLS is already correct, and this migration deliberately does not touch it.
--
-- `completed_sets` carries no `user_id` of its own; it is scoped by `log_id`, and
-- both its own policies and the coach-scoped one
-- (`20261003030000_coach_portal.sql:129-139`) qualify through
-- `workout_logs.user_id = auth.uid()`. A new column on a table whose policies
-- read it through a join inherits that scoping automatically -- there is no
-- policy to widen, and a policy written *for* the new column would be a second
-- source of truth for a fact the existing ones already decide.
--
-- Worth stating explicitly because "added a column, check the policies" is
-- usually a real step. Here it is a no-op, and the reason is above.
-- ---------------------------------------------------------------------------
