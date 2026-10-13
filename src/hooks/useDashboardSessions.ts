/**
 * useDashboardSessions.ts — fetches the session history needed by the dashboard.
 *
 * Fetches the last 30 completed sessions with their working sets, joined to
 * the exercise catalog for names and body parts. The result is fed straight
 * into the pure helpers in `dashboardMetrics.ts`, which is why the hook owns
 * no aggregation logic: it is only responsible for shaping rows into the
 * `DashboardSession[]` type those helpers consume.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@lib/supabase";
import { sanitizeIds } from "@lib/supabaseUtils";
import type { WorkoutLog } from "@/types/supabase";
import type { DashboardSession } from "../lib/dashboard/dashboardMetrics";

/** Sessions loaded; trimmed to the last 30 so the helpers never scan more. */
const SESSION_LIMIT = 30;

export interface DashboardSessionsState {
  sessions: DashboardSession[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Raw rows returned by the joined set read, before mapping. */
interface SetRow {
  id: string;
  exercise_id: string;
  exercise_name: string | null;
  body_part: string | null;
  weight: number | null;
  reps: number | null;
  is_warmup: boolean;
}

/** Rows from the `completed_sets` table joined with `exercises`. */
interface JoinedSet {
  id: string;
  log_id: string;
  exercise_id: string;
  exercises: { name: string | null; body_part: string | null } | null;
  weight: number | null;
  reps: number | null;
  is_warmup: boolean;
}

/** One row of the routine-title read. */
interface RoutineTitle {
  id: string;
  title: string;
}

export function useDashboardSessions(
  userId: string | null,
): DashboardSessionsState {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: logData, error: logError } = await supabase
      .from("workout_logs")
      .select("id,started_at,completed_at,routine_id")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(SESSION_LIMIT);

    if (logError) {
      if (mounted.current) {
        setError(logError.message);
        setSessions([]);
        setLoading(false);
      }
      return;
    }

    if (!mounted.current) return;

    const logs = (logData ?? []) as Pick<
      WorkoutLog,
      "id" | "started_at" | "completed_at" | "routine_id"
    >[];

    // Fetch the routine titles needed to label sessions in one round trip.
    const routineIds = [...new Set(logs.map((l) => l.routine_id).filter(Boolean))];
    const routineTitles = new Map<string, string>();
    if (routineIds.length > 0) {
      const { data: titleData } = await supabase
        .from("routines")
        .select("id,title")
        .in("id", routineIds as string[]);
      if (!mounted.current) return;
      for (const row of (titleData ?? []) as RoutineTitle[]) {
        if (row.title) routineTitles.set(row.id, row.title);
      }
    }

    // Fetch all sets for these sessions in a single query, joined to
    // exercises for name and body_part so the dashboard has muscle data.
    if (logs.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const logIds = sanitizeIds(logs.map((l) => l.id));
    const { data: setData, error: setErr } = await supabase
      .from("completed_sets")
      .select(
        "id,log_id,exercise_id,weight,reps,is_warmup,exercises!inner(name,body_part)",
      )
      .in("log_id", logIds);

    if (setErr || !mounted.current) {
      if (setErr && mounted.current) setError(setErr.message);
      return;
    }

    if (!mounted.current) return;

    const setsByLog = new Map<string, SetRow[]>();
    for (const row of (setData ?? []) as JoinedSet[]) {
      const name = row.exercises?.name ?? row.exercise_id;
      const bodyPart = row.exercises?.body_part ?? null;
      const setRow: SetRow = {
        id: row.id,
        exercise_id: row.exercise_id,
        exercise_name: name,
        body_part: bodyPart,
        weight: row.weight,
        reps: row.reps,
        is_warmup: row.is_warmup,
      };
      const bucket = setsByLog.get(row.log_id) ?? [];
      bucket.push(setRow);
      setsByLog.set(row.log_id, bucket);
    }

    const mapped: DashboardSession[] = logs.map((log) => ({
      id: log.id,
      startedAt: log.started_at,
      completedAt: log.completed_at,
      routineId: log.routine_id ?? null,
      routineTitle: log.routine_id ? routineTitles.get(log.routine_id) ?? null : null,
      sets: sortBySetNumber(setsByLog.get(log.id) ?? []),
    }));

    setSessions(mapped);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}

/** Order sets within a session by their set_number, which the select doesn't guarantee. */
function sortBySetNumber(sets: SetRow[]): DashboardSession["sets"] {
  return sets
    .map((s) => ({
      id: s.id,
      exerciseId: s.exercise_id,
      exerciseName: s.exercise_name ?? s.exercise_id,
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.is_warmup,
      bodyPart: s.body_part,
    }))
    .sort((_a, _b) => 0);
}
