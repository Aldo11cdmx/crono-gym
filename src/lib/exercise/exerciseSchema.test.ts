/**
 * @vitest-environment node
 *
 * exerciseSchema.test.ts — the three places that have to agree about `completed_sets`.
 *
 * A column added in SQL, declared in the generated types and read in a query are three
 * separate edits, and nothing in the toolchain cross-checks them. `tsc` catches it when a
 * query selects a column the types do not have -- which is the good case, because it fails
 * at build time. It does not catch the reverse: a column in the types and in the database
 * that no query ever reads, which is a feature that silently does nothing.
 *
 * So this reads all three as text and asserts they line up. It is a guard on the *migration*
 * rather than on behaviour, which is unusual, and it earns its place because the failure it
 * catches is invisible at runtime.
 */

import { describe, expect, it } from "vitest";
import migrationSource from "../../../supabase/migrations/20261003040000_exercise_hub_notes.sql?raw";
import supabaseTypesSource from "../../types/supabase.ts?raw";
import offlineStoreSource from "../offlineStore.ts?raw";
import historySource from "./exerciseHistory.ts?raw";
import notesSource from "./exerciseNotes.ts?raw";
import { EXERCISE_NOTES } from "./exerciseNotes";

describe("the notes column", () => {
  it("exists in the migration, in the types, and in the query that reads it", () => {
    // The migration adds it...
    expect(migrationSource).toMatch(
      /alter table public\.completed_sets\s+add column if not exists notes text/,
    );
    // ...the types declare it on all three of Row, Insert and Update, because PostgREST
    // needs it in all three and a Row-only declaration type-checks a read while breaking the
    // write...
    const completedSets = supabaseTypesSource.slice(
      supabaseTypesSource.indexOf("completed_sets: {"),
    );
    expect(completedSets.slice(0, 2000)).toContain("notes: string | null");
    // ...and the history query projects it, or the whole column is written and never read.
    expect(historySource).toMatch(/select\([\s\S]*?notes[\s\S]*?\)/);
  });

  it("carries it through the offline queue, or a note written without signal is lost", () => {
    // The queue is how a set reaches Supabase at all. `QueuedSet` without `notes` means
    // every note written on a plane is silently dropped at sync, with no error anywhere.
    expect(offlineStoreSource).toMatch(/notes\?: string \| null/);
  });

  it("keeps null and empty string apart", () => {
    // Null is "no note"; `''` is a note someone deliberately blanked. Collapsing them makes
    // "I wrote nothing" indistinguishable from "I wrote a blank", which the hub's coverage
    // ratio reports on.
    expect(migrationSource).toMatch(/notes is null or char_length\(notes\) <= 2000/);
    expect(EXERCISE_NOTES.MAX_LENGTH).toBe(2000);
    // And the app's bound equals the database's, or one of the two rejects notes the other
    // accepts -- the latter surfacing as a failed sync on a workout the athlete thinks is
    // saved.
    const boundInMigration = migrationSource.match(/char_length\(notes\) <= (\d+)/);
    expect(boundInMigration).not.toBeNull();
    expect(Number(boundInMigration![1])).toBe(EXERCISE_NOTES.MAX_LENGTH);
  });

  it("leaves the trim to the app, which is where it can be done", () => {
    // `normaliseNote` trims before measuring, so 2000 characters plus a trailing newline is
    // accepted and 2001 plus a trailing newline is not. The SQL cannot trim what it is
    // given -- it has to accept the value that reaches the column -- so the app's trim is
    // what makes the two agree.
    //
    // Asserted behaviourally in `exerciseNotes.test.ts` ("bounds the length after trimming,
    // matching the SQL constraint") rather than here. A source-position check would be the
    // wrong tool: the `NoteRejection` type mentions `too_long` long before the trim is
    // written, so the two offsets compare as if the check ran first while telling us
    // nothing about what runs when.
    expect(notesSource).toMatch(/const note = raw\.trim\(\)/);
  });
});

describe("is_warmup", () => {
  it("was already there, so the migration does not add it", () => {
    // The brief asked for `is_warmup` as if it were missing. It is not: `schema.sql`
    // declares it, the types have carried it, and `useAthletePRs` filters on it. Re-adding
    // it would either be a no-op or an error. Asserted as a *negative* so that a future
    // migration cannot quietly reintroduce a column the database already has -- `add column`
    // without `if not exists` is a hard failure on the second `db push`.
    expect(migrationSource).not.toMatch(/add column[^;]*is_warmup/);
    // But the index below does depend on it.
    expect(migrationSource).toMatch(/where is_warmup = false/);
  });
});

describe("the exercise_id index", () => {
  it("is partial on is_warmup, matching the filter the hub applies", () => {
    // A full index would be larger and slower for the only query that matters. Partial
    // because every read of this table outside the hub's own history query filters warm-ups
    // out, so the excluded rows are never fetched by anything.
    expect(migrationSource).toMatch(
      /create index if not exists idx_completed_sets_exercise_id\s+on public\.completed_sets \(exercise_id\)\s+where is_warmup = false/,
    );
  });

  it("matches the filter in the query that has to use it", () => {
    // The index and the query are the same decision written twice. If one drops the
    // `is_warmup` filter the other becomes useless, and nothing fails -- the query just
    // gets slower.
    expect(historySource).toMatch(/\.eq\("is_warmup", false\)/);
    expect(historySource).toMatch(/\.eq\("exercise_id", exerciseId\)/);
  });

  it("orders descending, because the limit truncates", () => {
    // With `limit` and ascending order a bounded query returns the athlete's *oldest* sets.
    expect(historySource).toMatch(/ascending: false/);
    // And through the referenced table, because `started_at` lives on `workout_logs`.
    expect(historySource).toMatch(/referencedTable: "workout_logs"/);
  });

  it("keeps the `!inner` join, which is what scopes the read to one athlete", () => {
    // `completed_sets` has no `user_id`. Without `!inner` the `.eq` becomes a post-join
    // predicate and cannot remove parent rows it does not match, so the query would return
    // other people's sets. This is the single most dangerous line in the file.
    expect(historySource).toMatch(/workout_logs!inner\(started_at\)/);
    expect(historySource).toMatch(/\.eq\("workout_logs\.user_id", userId\)/);
  });
});
