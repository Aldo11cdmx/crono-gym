import { useCallback, useEffect, useState } from "react";
import { supabase } from "@lib/supabase";
import type { Exercise, Routine, RoutineExercise, WorkoutLog } from "@/types/supabase";

export interface PlannedExercise {
  exercise: Exercise;
  target_sets: number;
  rest_seconds: number;
}

export interface RoutineWithExercises extends Routine {
  exercises: PlannedExercise[];
}

export interface WeekPoint {
  label: string;
  date: string;
  count: number;
}

export interface RecentSession {
  id: string;
  started_at: string;
  routineTitle: string;
  sets: number;
  volume: number;
}

export interface ProgressStats {
  totalWorkouts: number;
  workoutsThisMonth: number;
  bestWeight: number | null;
  monthlyVolume: number;
  week: WeekPoint[];
  recent: RecentSession[];
}

const EMPTY_STATS: ProgressStats = {
  totalWorkouts: 0,
  workoutsThisMonth: 0,
  bestWeight: null,
  monthlyVolume: 0,
  week: [],
  recent: [],
};

/** Loads the routine catalogue for a user, flattened with their planned exercises. */
export function useRoutines(userId: string | null) {
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRoutines([]);
      return;
    }
    setLoading(true);
    setError(null);
    const [routineRes, linkRes, exerciseRes] = await Promise.all([
      supabase.from("routines").select("*").eq("user_id", userId),
      supabase.from("routine_exercises").select("*"),
      supabase.from("exercises").select("*"),
    ]);
    if (routineRes.error) {
      setError(routineRes.error.message);
      setRoutines([]);
      setLoading(false);
      return;
    }
    if (linkRes.error || exerciseRes.error) {
      setError((linkRes.error ?? exerciseRes.error)!.message);
      setRoutines([]);
      setLoading(false);
      return;
    }

    const rows = (routineRes.data ?? []) as Routine[];
    const links = (linkRes.data ?? []) as RoutineExercise[];
    const catalog = new Map<string, Exercise>(
      ((exerciseRes.data ?? []) as Exercise[]).map((e) => [e.id, e]),
    );
    const byRoutine = new Map<string, PlannedExercise[]>();
    for (const link of [...links].sort((a, b) => a.order_index - b.order_index)) {
      const exercise = catalog.get(link.exercise_id);
      if (!exercise) continue;
      const list = byRoutine.get(link.routine_id) ?? [];
      list.push({
        exercise,
        target_sets: link.target_sets,
        rest_seconds: link.rest_seconds,
      });
      byRoutine.set(link.routine_id, list);
    }

    setRoutines(
      rows
        .map((r) => ({ ...r, exercises: byRoutine.get(r.id) ?? [] }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { routines, loading, error, refresh };
}

/** Aggregates logged workouts into the metrics shown on the progress view. */
export function useProgress(userId: string | null) {
  const [stats, setStats] = useState<ProgressStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStats(EMPTY_STATS);
      return;
    }
    setLoading(true);
    setError(null);

    const { data: logData, error: logError } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(50);
    if (logError) {
      setError(logError.message);
      setLoading(false);
      return;
    }

    const logs = (logData ?? []) as WorkoutLog[];
    const ids = new Set(logs.map((l) => l.id));
    const routineRes = await supabase.from("routines").select("id,title");
    const routineTitles = new Map<string, string>(
      ((routineRes.data ?? []) as { id: string; title: string }[]).map((r) => [
        r.id,
        r.title,
      ]),
    );

    const byLog = new Map<
      string,
      { sets: number; volume: number; best: number | null }
    >();
    if (ids.size > 0) {
      const { data: setData } = await supabase
        .from("completed_sets")
        .select("log_id,weight,reps")
        .in(
          "log_id",
          [...ids],
        );
      for (const row of (setData ?? []) as {
        log_id: string;
        weight: number | null;
        reps: number | null;
      }[]) {
        const bucket = byLog.get(row.log_id) ?? { sets: 0, volume: 0, best: null };
        bucket.sets += 1;
        bucket.volume += (row.weight ?? 0) * (row.reps ?? 0);
        bucket.best =
          row.weight === null ? bucket.best : Math.max(bucket.best ?? 0, row.weight);
        byLog.set(row.log_id, bucket);
      }
    }

    setStats(summarize(logs, byLog, routineTitles));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

function summarize(
  logs: WorkoutLog[],
  byLog: Map<string, { sets: number; volume: number; best: number | null }>,
  routineTitles: Map<string, string>,
): ProgressStats {
  const done = logs.filter((l) => l.completed_at);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = done.filter((l) => new Date(l.started_at) >= monthStart);

  const week: WeekPoint[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = dayKey(day);
    week.push({
      label: new Intl.DateTimeFormat("es-ES", { weekday: "short" })
        .format(day)
        .replace(".", ""),
      date: key,
      count: done.filter((l) => dayKey(new Date(l.started_at)) === key).length,
    });
  }

  let bestWeight: number | null = null;
  let monthlyVolume = 0;
  const recent: RecentSession[] = logs.slice(0, 6).map((l) => {
    const bucket = byLog.get(l.id) ?? { sets: 0, volume: 0, best: null };
    if (bucket.best !== null) bestWeight = Math.max(bestWeight ?? 0, bucket.best);
    return {
      id: l.id,
      started_at: l.started_at,
      routineTitle: l.routine_id ? routineTitles.get(l.routine_id) ?? "Rutina" : "Sesión libre",
      sets: bucket.sets,
      volume: Math.round(bucket.volume),
    };
  });
  for (const log of inMonth) monthlyVolume += byLog.get(log.id)?.volume ?? 0;

  return {
    totalWorkouts: done.length,
    workoutsThisMonth: inMonth.length,
    bestWeight,
    monthlyVolume: Math.round(monthlyVolume),
    week,
    recent,
  };
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Formats a weight for display, hiding decimals when they are not needed. */
export function formatWeight(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? `${value} kg` : `${value.toFixed(1)} kg`;
}