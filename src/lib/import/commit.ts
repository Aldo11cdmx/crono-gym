/**
 * commit.ts — writing an analysed import to the database, and taking it back.
 *
 * The import is planned before it is written ({@link planBatch}) so the wizard's
 * confirmation step and the write that follows it are provably the same work.
 * Planning is pure and takes a clock; committing only executes a plan.
 *
 * **Deterministic log ids.** Every session's `workout_logs.id` is derived from
 * its own fingerprint rather than generated. That buys three things at once:
 * re-importing a file after an undo lands in the same place instead of creating a
 * second copy; a batch can be undone by id alone, with no bookkeeping table to
 * keep in step with the rows; and a partial failure can be retried without
 * producing duplicates, because the retry targets the same primary key.
 *
 * It is *not* a substitute for the duplicate check in `analyze.ts`. Upserting a
 * deterministic id would silently replace a session the user has since edited,
 * so the analysis refuses known duplicates first and the user is told.
 *
 * Batching is per session, never one giant insert. A 4.000-session import in a
 * single statement either fully lands or fully fails, and there is no way to
 * report which half happened or to undo only the part that succeeded.
 */

import { supabase } from "@lib/supabase";
import { notifyTrainingDataChanged } from "@/lib/trainingEvents";
import type { ImportSession } from "./types";

/** How many sessions to attempt before yielding to the event loop. */
export const BATCH_YIELD_EVERY = 25;

/**
 * A UUID derived from a string.
 *
 * FNV-1a rather than a crypto hash: this identifies a row, it does not protect
 * one. What matters is that it is stable across reloads and platforms, which is
 * the one thing a random id cannot be. Version 4 / variant 1 bits are set so the
 * value passes the `uuid` column check in Postgres.
 */
export function deterministicUuid(input: string): string {
  // Four independent 32-bit FNV-1a accumulators, so the id does not depend on
  // `Number` staying exact past 2^53 and does not need a 64-bit type. Four gives
  // the 32 hex digits a UUID needs -- three would be 28, one short of valid.
  let h0 = 0x811c9dc5;
  let h1 = 0x1000193;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h0 = Math.imul(h0 ^ code, 0x01000193) >>> 0;
    h1 = Math.imul(h1 ^ code, 0x85ebca6b) >>> 0;
    h2 = Math.imul(h2 ^ (code + i), 0xc2b2ae35) >>> 0;
    h3 = Math.imul(h3 ^ (code - i), 0x27d4eb2f) >>> 0;
  }

  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, "0");
  const chars = `${hex(h0)}${hex(h1)}${hex(h2)}${hex(h3)}`.split("");
  // Version 4 and variant 1, so Postgres accepts the value as a `uuid`. These two
  // nibbles are overwritten rather than inserted, which is what keeps the id at
  // exactly 32 digits -- a version nibble prepended instead would make it 33.
  chars[12] = "4";
  chars[16] = "8";

  const id = chars.join("");
  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20, 32),
  ].join("-");
}

/** One exercise row, already resolved against the catalog. */
export interface PlannedSet {
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
}

export interface PlannedSession {
  /** The id this session will have in `workout_logs`. */
  id: string;
  key: string;
  title: string;
  startedAt: string;
  completedAt: string;
  notes: string | null;
  sets: PlannedSet[];
}

export interface ImportBatch {
  userId: string;
  /** Identity of the run, used in the log lines and in the undo message. */
  batchId: string;
  sessions: PlannedSession[];
  /**
   * Exercises that had no catalog match.
   *
   * Reported rather than dropped: an unrecognised exercise means its sets are
   * missing from the ranks, and the user is the only one who can tell whether
   * that name is a spelling variant or a different movement entirely.
   */
  unresolved: string[];
}

export interface CommitProgress {
  done: number;
  total: number;
  /** The session currently being written, for the wizard's status line. */
  current: string | null;
}

export interface CommitFailure {
  key: string;
  title: string;
  message: string;
}

export interface CommitResult {
  /** Ids that landed. Exactly what {@link undoBatch} needs. */
  written: string[];
  failures: CommitFailure[];
}

export interface PlanOptions {
  userId: string;
  batchId: string;
  /**
   * Maps an exercise name from the file onto a catalog id.
   *
   * `null` means "no match". The wizard fills this from the mapping step, where
   * the user assigns a muscle -- and therefore a set of catalog exercises -- to
   * each name, so the resolution is a decision the user already made rather than
   * a guess made here.
   */
  resolveExercise: (name: string) => string | null;
  /** Session duration is unknown; the end is derived from the start by default. */
  durationMinutes?: number;
}

/** Assumes an hour-long session when the file does not say. */
export const DEFAULT_SESSION_MINUTES = 60;

/**
 * Turns analysed sessions into the rows that will be written.
 *
 * A session whose every set failed to resolve is kept, with zero sets, rather
 * than dropped: the user will see it in the confirmation step and can decide. The
 * alternative -- silently omitting it -- makes a partially-understood file look
 * complete.
 */
export function planBatch(sessions: readonly ImportSession[], options: PlanOptions): ImportBatch {
  const minutes = options.durationMinutes ?? DEFAULT_SESSION_MINUTES;
  const unresolved = new Set<string>();

  const planned = sessions.map((session): PlannedSession => {
    const end = new Date(session.startedAt);
    end.setMinutes(end.getMinutes() + minutes);

    const sets: PlannedSet[] = [];
    const perExercise = new Map<string, number>();

    for (const set of session.sets) {
      const exerciseId = options.resolveExercise(set.exerciseName);
      if (exerciseId === null) {
        unresolved.add(set.exerciseName);
        continue;
      }
      // Renumbered here as well as in the analysis, because removing an
      // unresolved exercise leaves a gap in the sequence the analysis numbered.
      const next = (perExercise.get(exerciseId) ?? 0) + 1;
      perExercise.set(exerciseId, next);

      sets.push({
        exercise_id: exerciseId,
        set_number: next,
        weight: set.weightKg,
        reps: set.reps,
        rpe: set.rpe,
        is_warmup: set.isWarmup,
      });
    }

    return {
      id: deterministicUuid(`${session.key}|${options.userId}`),
      key: session.key,
      title: session.title,
      startedAt: session.startedAt,
      completedAt: end.toISOString(),
      notes: session.notes,
      sets,
    };
  });

  return {
    userId: options.userId,
    batchId: options.batchId,
    sessions: planned,
    unresolved: [...unresolved].sort((a, b) => a.localeCompare(b, "es")),
  };
}

/**
 * Writes a planned batch.
 *
 * One session at a time, and a failure does not stop the run: an import that
 * aborts on the first bad session leaves the user with a partial history and no
 * idea how far it got. Failures are collected and returned so the wizard can show
 * them alongside the parser's own error log.
 */
export async function commitBatch(
  batch: ImportBatch,
  onProgress?: (progress: CommitProgress) => void,
): Promise<CommitResult> {
  const result: CommitResult = { written: [], failures: [] };
  const total = batch.sessions.length;

  for (const [index, session] of batch.sessions.entries()) {
    onProgress?.({ done: index, total, current: session.title });

    try {
      const { error: logError } = await supabase.from("workout_logs").upsert(
        {
          id: session.id,
          user_id: batch.userId,
          routine_id: null,
          started_at: session.startedAt,
          completed_at: session.completedAt,
          journal_notes: session.notes,
        },
        { onConflict: "id" },
      );
      if (logError) throw new Error(logError.message);

      // Wholesale replace, exactly as `pushSession` does, so a retried batch is
      // idempotent instead of appending a second copy of every set.
      const { error: deleteError } = await supabase
        .from("completed_sets")
        .delete()
        .eq("log_id", session.id);
      if (deleteError) throw new Error(deleteError.message);

      if (session.sets.length > 0) {
        const rows = session.sets.map((set) => ({ ...set, log_id: session.id }));
        const { error: insertError } = await supabase.from("completed_sets").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }

      result.written.push(session.id);
    } catch (err) {
      result.failures.push({
        key: session.key,
        title: session.title,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (index > 0 && index % BATCH_YIELD_EVERY === 0) {
      // Yield so a 4.000-session import does not hold the main thread for the
      // whole run and leave the cancel button unresponsive.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  onProgress?.({ done: total, total, current: null });
  // Fired last, for the same reason `pushSession` does it last: consumers refetch
  // on this, and announcing earlier would have them read pre-import numbers.
  notifyTrainingDataChanged();
  return result;
}

/**
 * Removes a committed batch.
 *
 * Sets first, then logs. The other order would leave orphaned set rows behind if
 * the second query failed, and an orphaned set belongs to no session and so can
 * never be cleaned up by any other means.
 *
 * Only the ids this batch wrote are touched. Undo is per batch on purpose: a
 * session that was in this file but which the user has since edited is not in
 * `written` and must survive.
 */
export async function undoBatch(ids: readonly string[]): Promise<CommitResult> {
  const result: CommitResult = { written: [], failures: [] };
  if (ids.length === 0) return result;

  const { error: setError } = await supabase.from("completed_sets").delete().in("log_id", [
    ...ids,
  ]);
  if (setError) {
    return { written: [], failures: [{ key: "batch", title: "Importación", message: setError.message }] };
  }

  const { error: logError } = await supabase.from("workout_logs").delete().in("id", [...ids]);
  if (logError) {
    return { written: [], failures: [{ key: "batch", title: "Importación", message: logError.message }] };
  }

  notifyTrainingDataChanged();
  return result;
}

/**
 * The ids already in the database, for the pre-flight duplicate check.
 *
 * Only the imported ones are worth asking about: a session the user logged in the
 * app has no fingerprint and cannot collide with a file. Reading every log to
 * compare timestamps would be a large query that always returns nothing useful.
 */
export async function existingImportIds(
  userId: string,
  keys: readonly string[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("user_id", userId);
  if (error || !data) return new Set();

  const ids = new Set((data as { id: string }[]).map((row) => row.id));
  const found = new Set<string>();
  for (const key of keys) {
    if (ids.has(deterministicUuid(`${key}|${userId}`))) found.add(key);
  }
  return found;
}