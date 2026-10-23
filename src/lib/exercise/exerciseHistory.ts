/**
 * exercise/exerciseHistory.ts — the one query the exercise hub reads.
 *
 * Every other module in this directory is a pure function *over* what this file fetches:
 * `exerciseMetrics` turns it into numbers, `exercisePlateau` looks for the stall,
 * `exerciseFatigue` for the cost, `exerciseNotes` pulls the prose back out. So this is the
 * only module that talks to Supabase, and the only one that can be wrong about the network
 * rather than about arithmetic.
 *
 * The shape it returns
 * --------------------
 * `ExerciseSetRecord` is deliberately flat and deliberately includes `log_id` and
 * `started_at`. It could hide both behind a nested `session`, and it does not, because
 * every one of the four consumers needs to group by session or order by time, and a
 * flattened row means the grouping is a `Map` over data already in memory instead of a
 * tree walk per access. A set's whole meaning is "on this day, in this workout, at this
 * weight", and a row that carries all three facts is one that cannot be assembled wrongly.
 *
 * Why the query is shaped the way it is
 * -------------------------------------
 * This is `useAthletePRs.ts`'s query with the projection widened, not a new one:
 *
 *   - `.eq("workout_logs.user_id", userId)` and the `!inner` join are load-bearing.
 *     `completed_sets` has no `user_id` of its own -- it is scoped by `log_id` -- so
 *     without the `!inner` the `.eq` becomes a post-join predicate and cannot remove the
 *     parent rows it does not match, which returns other people's sets.
 *   - `.eq("is_warmup", false)` matches the partial index added in
 *     `20261003040000_exercise_hub_notes.sql`, so it is a plain index lookup rather than
 *     a scan. The hub never shows warm-ups in its history: they are not attempts, and a
 *     PR list or a trend line that includes them is describing something nobody did.
 *   - The `.eq("exercise_id", ...)` is the other half of that index, and the reason it
 *     exists. Without it the hub's central read is a sequential scan of every set the
 *     athlete has ever done.
 *   - The order is `started_at` descending through the *referenced* table, because that
 *     is the column, and because "most recent first" is the only order that makes a
 *     bounded query correct: `limit` truncates, so with ascending order a limit returns
 *     the athlete's *oldest* sets.
 *
 * `.not("weight", "is", null)` is inherited from the PR query and kept for one reason
 * beyond convenience: an unweighted set is bodyweight, and a bodyweight "trend" in
 * kilograms is a lie. It is filtered rather than coerced.
 */

import { supabase } from "../supabase";

/**
 * One working set, flattened with the two facts from `workout_logs` that a set cannot
 * be interpreted without.
 */
export interface ExerciseSetRecord {
  /** `completed_sets.id`. Stable, and what a note is keyed by. */
  id: string;
  /** `completed_sets.log_id`. Groups the sets of one session. */
  log_id: string;
  exercise_id: string;
  set_number: number;
  /** `numeric` in Postgres, so a decimal string -- parsed once, below. */
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  /** `20261003040000_exercise_hub_notes.sql`. Null means no note, not an empty one. */
  notes: string | null;
  /** ISO timestamp of the session the set belongs to, not of the set. */
  started_at: string;
}

/** What a read can end in, as the callers actually have to handle it. */
export type HistoryResult =
  | { ok: true; sets: ExerciseSetRecord[] }
  | { ok: false; error: string };

/**
 * How many sets to read.
 *
 * A bound rather than "read everything", because this app runs on a phone over a gym's
 * wifi and the history tab is opened while resting between sets. A year of logging is
 * easily a few thousand rows and the query has to be fast enough to not be noticed.
 *
 * Generous on purpose: it is one round trip and the rows are small, and a cap low enough
 * to be cheap would quietly truncate a plateau -- which is the one thing this data exists
 * to reveal, and the one thing that looks like a real finding when it is an artefact of
 * the cap. Anything beyond this is a paging decision for whoever builds the UI, and it
 * belongs there where the paging is visible.
 */
export const HISTORY_LIMIT = 2000;

/**
 * Parses the `numeric` weight Postgres returns.
 *
 * `numeric` arrives as a string -- `85.5`, or `"85.500"` for a column that was written
 * with more precision than the value needs. `Number.parseFloat` would give `85.5` either
 * way, but the explicit check is the point: a malformed weight must become `null` and be
 * dropped by the metric that needs it, not become `NaN` and poison an average silently.
 */
function parseWeight(raw: number | string | null): number | null {
  if (raw === null || raw === "") return null;
  const parsed = typeof raw === "number" ? raw : Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads every working set the athlete has logged for one exercise.
 *
 * Returns a discriminated result rather than throwing or returning `[]` on failure,
 * because the three outcomes are genuinely different and the caller has to tell them
 * apart: an empty history is a first week and should render as an invitation, an error is
 * a network or RLS problem and should render as a retry, and conflating them is how a
 * failed read shows up as "no data yet" and gets believed.
 */
export async function loadExerciseHistory(
  userId: string,
  exerciseId: string,
  limit: number = HISTORY_LIMIT,
): Promise<HistoryResult> {
  if (!userId || !exerciseId) {
    // Not an error worth surfacing: this is a screen opened before the session resolved,
    // or a catalogue row with no slug. The caller renders nothing and retries on mount.
    return { ok: true, sets: [] };
  }

  const { data, error } = await supabase
    .from("completed_sets")
    .select(
      "id,log_id,exercise_id,set_number,weight,reps,rpe,notes,workout_logs!inner(started_at)",
    )
    .eq("workout_logs.user_id", userId)
    .eq("exercise_id", exerciseId)
    .eq("is_warmup", false)
    .not("weight", "is", null)
    .order("started_at", { referencedTable: "workout_logs", ascending: false })
    .limit(limit);

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as unknown as RawRow[];
  const sets: ExerciseSetRecord[] = [];

  for (const row of rows) {
    // A row whose weight did not parse is dropped rather than kept with a null weight:
    // the query already filtered `weight is not null`, so a null here means the value
    // existed and was unparseable, and such a row is a bug to surface in the row count
    // rather than a bodyweight set to average in.
    const weight = parseWeight(row.weight);
    if (weight === null) continue;

    sets.push({
      id: row.id,
      log_id: row.log_id,
      exercise_id: row.exercise_id,
      set_number: row.set_number,
      weight,
      reps: row.reps,
      rpe: row.rpe,
      notes: row.notes ?? null,
      started_at: readStartedAt(row.workout_logs),
    });
  }

  return { ok: true, sets };
}

/** The row as PostgREST hands it back, before `numeric` and the join are unpacked. */
interface RawRow {
  id: string;
  log_id: string;
  exercise_id: string;
  set_number: number;
  weight: number | string | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  /** The `!inner` join: an array of the referenced table's selected columns. */
  workout_logs: { started_at: string } | { started_at: string }[] | null;
}

/**
 * Reads `started_at` out of the join.
 *
 * PostgREST returns an embedded one-to-many as an array and a many-to-one as an object,
 * and which one arrives depends on the relationship it walked -- not on what the query
 * asked for. Both shapes are accepted here rather than asserted in the query, because the
 * alternative is a cast that lies and a `row.workout_logs.started_at` that is `undefined`
 * at runtime on a database where the planner chose the other direction.
 *
 * A missing or malformed timestamp sorts the row last rather than throwing: a set whose
 * date cannot be read is still a set the athlete did, and dropping it would silently
 * shorten their history. It is pushed to the epoch, which every `sort` in these modules
 * handles by putting it at the end.
 */
function readStartedAt(joined: RawRow["workout_logs"]): string {
  const value = Array.isArray(joined) ? joined[0]?.started_at : joined?.started_at;
  if (typeof value !== "string" || value === "") return EPOCH;
  return Number.isNaN(Date.parse(value)) ? EPOCH : value;
}

/**
 * The timestamp used when a row's date cannot be read.
 *
 * `new Date(0).toISOString()`, stated once. Sorting ascending puts it first and
 * descending puts it last, which is the intent: an undated set belongs at the far end of
 * the history, never interleaved with real dates where it would read as "that week".
 */
export const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Groups sets into sessions, newest session first.
 *
 * By `log_id` and not by date: two sessions on the same afternoon are two sessions, and
 * collapsing them by timestamp would merge a morning workout with the evening one and
 * report a single 14-set session that never happened.
 *
 * Order is by the session's newest set rather than its oldest, so the tab reads
 * "7 mar, 14 mar, 2 abr" by when the athlete was last there.
 */
export function groupBySession(sets: readonly ExerciseSetRecord[]): ExerciseSession[] {
  const sessions = new Map<string, ExerciseSetRecord[]>();

  for (const set of sets) {
    const existing = sessions.get(set.log_id);
    if (existing) existing.push(set);
    else sessions.set(set.log_id, [set]);
  }

  return [...sessions.entries()]
    .map(([logId, sessionSets]) => ({
      logId,
      startedAt: sessionSets[0].started_at,
      // By `set_number` so the list reads in the order they were performed, which is not
      // the order the query returned them in.
      sets: [...sessionSets].sort((a, b) => a.set_number - b.set_number),
    }))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

/** One workout's worth of sets for one exercise. */
export interface ExerciseSession {
  logId: string;
  /** ISO timestamp of the session. */
  startedAt: string;
  /** In `set_number` order. */
  sets: ExerciseSetRecord[];
}
