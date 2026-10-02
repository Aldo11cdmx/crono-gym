/**
 * usePreviousPerformance.ts — feeds "El Cerebro" (progressive overload).
 *
 * For each exercise in the current workout, resolves how the user actually
 * performed across their recent sessions so `suggestNextTarget()` can propose
 * the next target and `detectStall()` can spot stagnation.
 *
 * Two queries rather than an embedded select: the generated `Database` type
 * declares empty `Relationships`, so PostgREST embedding cannot infer the
 * joined shape. We fetch the user's recent logs, then the matching sets.
 */

import { useEffect, useState } from "react";
import { supabase } from "@lib/supabase";
import {
  bestWorkingSet,
  topWorkingRpe,
  type LoggedSet,
  type PreviousPerformance,
  type SessionSummary,
} from "../lib/overload";
import type { WorkoutLog } from "@/types/supabase";

/** How many past sessions to scan when resolving "last time". */
const LOG_WINDOW = 60;

export const EMPTY_PERFORMANCE: PreviousPerformance = {
  bestSet: null,
  allTimeBest: null,
  lastSetCount: 0,
  lastPerformedAt: null,
  history: [],
};

interface CompletedSetRow {
  log_id: string;
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
}

/**
 * @param userId       Authenticated user, or null while signed out.
 * @param exerciseIds  Exercise ids currently in the workout.
 * @returns performance keyed by exercise id, plus a `get()` reader that never
 *          returns undefined.
 */
export function usePreviousPerformance(userId: string | null, exerciseIds: string[]) {
  const [performance, setPerformance] = useState<Record<string, PreviousPerformance>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join ids so a fresh array identity each render does not refetch.
  const key = exerciseIds.join("|");

  useEffect(() => {
    const ids = key.length > 0 ? key.split("|") : [];
    // Arrow function (not a hoisted declaration) so the `uid` narrowing below
    // survives into the closure.
    const load = async () => {
      const uid = userId;
      if (!uid || ids.length === 0) {
        setPerformance({});
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data: logData, error: logError } = await supabase
          .from("workout_logs")
          .select("id, started_at")
          .eq("user_id", uid)
          .order("started_at", { ascending: false })
          .limit(LOG_WINDOW);
        if (logError) throw logError;

        const logs = (logData ?? []) as Pick<WorkoutLog, "id" | "started_at">[];
        if (logs.length === 0) {
          if (alive) setPerformance({});
          return;
        }

        const { data: setData, error: setErr } = await supabase
          .from("completed_sets")
          .select("log_id, exercise_id, weight, reps, rpe, is_warmup")
          .in(
            "log_id",
            logs.map((l) => l.id),
          )
          .in("exercise_id", ids);
        if (setErr) throw setErr;

        if (alive) setPerformance(groupPerformance((setData ?? []) as CompletedSetRow[], logs));
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
      } finally {
        if (alive) setLoading(false);
      }
    };

    let alive = true;
    void load();
    return () => {
      alive = false;
    };
  }, [userId, key]);

  return {
    performance,
    loading,
    error,
    get: (exerciseId: string) => performance[exerciseId] ?? EMPTY_PERFORMANCE,
  };
}

/**
 * Builds per-exercise history from the completed sets.
 *
 * `logs` arrives newest-first, so summaries[0] is "last time". Each exercise
 * gets its own session summaries in that same order, which is what
 * `detectStall()` walks when looking for stagnation.
 */
function groupPerformance(
  rows: CompletedSetRow[],
  logs: Pick<WorkoutLog, "id" | "started_at">[],
): Record<string, PreviousPerformance> {
  const toSet = (row: CompletedSetRow): LoggedSet => ({
    weight: row.weight,
    reps: row.reps,
    rpe: row.rpe,
    is_warmup: row.is_warmup,
  });

  const out: Record<string, PreviousPerformance> = {};
  for (const exerciseId of new Set(rows.map((r) => r.exercise_id))) {
    // Warm-ups never define "last time" -- they are not working sets.
    const mine = rows.filter((r) => r.exercise_id === exerciseId && !r.is_warmup);
    if (mine.length === 0) continue;

    const summaries: SessionSummary[] = [];
    // `logs` arrives newest-first, so appending in iteration order keeps
    // history[0] as "last time", which is what detectStall() expects.
    for (const log of logs) {
      const sessionRows = mine.filter((r) => r.log_id === log.id);
      if (sessionRows.length === 0) continue;
      const sets = sessionRows.map(toSet);
      summaries.push({
        performedAt: log.started_at,
        bestSet: bestWorkingSet(sets),
        topRpe: topWorkingRpe(sets),
        setCount: sessionRows.length,
      });
    }

    const latest = summaries[0];
    out[exerciseId] = {
      bestSet: latest?.bestSet ?? null,
      allTimeBest: bestWorkingSet(mine.map(toSet)),
      lastSetCount: latest?.setCount ?? 0,
      lastPerformedAt: latest?.performedAt ?? null,
      history: summaries,
    };
  }
  return out;
}