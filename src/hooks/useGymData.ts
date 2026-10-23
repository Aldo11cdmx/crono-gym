import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@lib/supabase";
import { sanitizeIds } from "@lib/supabaseUtils";
import type { Exercise, Routine, RoutineExercise, WorkoutLog } from "@/types/supabase";

export interface PlannedExercise {
  exercise: Exercise;
  target_sets: number;
  rest_seconds: number;
  /**
   * Which day of the routine this belongs to. Zero-based.
   *
   * Read from `routine_exercises.day_index`. Nullable for rows written before
   * the column existed — callers fall back to treating everything as day one.
   */
  dayIndex: number | null;
  /**
   * The coach's own name for the day — "Pecho y espalda", not "Day 1".
   *
   * Read from `routine_exercises.day_label`. Empty string when unnamed.
   */
  dayLabel: string;
  /**
   * The superset this exercise belongs to, when it is in one.
   *
   * Read from `routine_exercises.group_id`, the column that arrives with the
   * superset migration. Until then every row reads as "no group", which is the
   * truth: nothing has ever grouped two of these exercises. The field is
   * optional so a routine written before the grouping existed is still a
   * routine rather than a broken one.
   */
  groupId?: string | null;
}

export interface RoutineWithExercises extends Routine {
  exercises: PlannedExercise[];
}

/** Returned by a write: false means the server refused and local state was rolled back. */
export type WriteResult = boolean;

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
  /**
   * Ids with a favourite write in flight.
   *
   * A set rather than a boolean: the star is per-row, and a single global flag would
   * disable every other row's star for the duration of one write. It also gives the
   * UI something honest to render -- a disabled star reads as "unavailable", a
   * spinner reads as "saving".
   */
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  /**
   * In-flight favourite writes, keyed by routine id.
   *
   * A ref rather than state because this is coordination, not render state: it must
   * be readable synchronously inside `toggleFavorite` on the very next tap, and a
   * `useState` value would still hold the previous render's chain there.
   */
  const writesInFlight = useRef(new Map<string, Promise<WriteResult>>());

  /**
   * The list as the writes see it.
   *
   * `setRoutines`'s updater is not a getter. React may defer running it, and under
   * StrictMode it runs it twice, so reading a routine's current value out of the
   * updater's closure produced `false` for every write: the value sent to the server
   * was whatever the variable happened to hold when the request was built, not the
   * value being flipped. A ref mirror is updated eagerly, which is what makes the
   * flip correct, and it keeps two rapid taps agreeing with each other.
   */
  const routinesRef = useRef<RoutineWithExercises[]>([]);

  /** Applies an update to both the mirror and the rendered state. */
  const applyRoutines = useCallback((next: RoutineWithExercises[]) => {
    routinesRef.current = next;
    setRoutines(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      applyRoutines([]);
      return;
    }
    setLoading(true);
    setError(null);
    const routineRes = await supabase.from("routines").select("*").eq("user_id", userId);
    if (routineRes.error) {
      setError(routineRes.error.message);
      applyRoutines([]);
      setLoading(false);
      return;
    }

    const rows = (routineRes.data ?? []) as Routine[];
    const routineIds = rows.map((row) => row.id);

    /*
     * The links of *these* routines, with the exercise each one points at.
     *
     * It used to be three parallel reads: the routines, every link in the
     * table and every exercise in the table. Two of them were unbounded -- a
     * routine of four exercises made the app download 1,324 exercises and
     * every link every user had ever written. Now the links are read for
     * these routines only, and the exercise each link points at comes with
     * them, so the read is as long as the routines on screen.
     */
    const linkRes =
      routineIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("routine_exercises")
            .select("*, exercises(*)")
            .in("routine_id", routineIds);
    if (linkRes.error) {
      setError(linkRes.error.message);
      applyRoutines([]);
      setLoading(false);
      return;
    }

    /*
     * `group_id` is read through a widened row type on purpose: the column
     * arrives with the superset migration, and the read has to work both
     * before and after it without a second code path. `select("*")` returns
     * whatever the table has, so the moment the column exists this reads it
     * and the day before it reads nothing.
     *
     * `exercises` is the row the link points at, delivered with the link.
     */
    const links = (linkRes.data ?? []) as unknown as (RoutineExercise & {
      group_id?: string | null;
      exercises: Exercise | null;
    })[];
    const byRoutine = new Map<string, PlannedExercise[]>();
    for (const link of [...links].sort((a, b) => a.order_index - b.order_index)) {
      const exercise = link.exercises;
      if (!exercise) continue;
      const list = byRoutine.get(link.routine_id) ?? [];
      list.push({
        exercise,
        target_sets: link.target_sets,
        rest_seconds: link.rest_seconds,
        dayIndex: link.day_index ?? null,
        dayLabel: link.day_label ?? "",
        groupId: link.group_id ?? null,
      });
      byRoutine.set(link.routine_id, list);
    }

    applyRoutines(
      rows
        .map((r) => ({ ...r, exercises: byRoutine.get(r.id) ?? [] }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
    setLoading(false);
  }, [userId, applyRoutines]);

  /**
   * Flips a routine's favourite flag, optimistically.
   *
   * The row updates before the request resolves, because a star that waits on a
   * round trip feels broken -- the tap is the feedback. If the server refuses, the
   * row is restored and `error` carries the reason; the alternative is a star that
   * silently reverts on the next render with nothing to explain why.
   *
   * The update is filtered by `user_id` as well as `id`. RLS already scopes the read,
   * but the write is the thing being defended here: a routine id is a uuid that an
   * athlete can put in their own payload, and the `.eq("user_id", userId)` is what
   * makes a row belonging to somebody else update zero rows instead of one.
   *
   * Writes are serialised per id. Two rapid taps reading the same optimistic row
   * would both compute the same target and the second tap -- meant to unstar --
   * would leave the routine starred. Chaining on the previous write makes the
   * second read the first write's settled value.
   *
   * @returns whether the server accepted the change.
   */
  const toggleFavorite = useCallback(
    async (routineId: string): Promise<WriteResult> => {
      if (!userId) return false;

      const previous = writesInFlight.current.get(routineId) ?? Promise.resolve(true);
      const run = previous.then(async (): Promise<WriteResult> => {
        const row = routinesRef.current.find((r) => r.id === routineId);
        // A missing row is not a failure to report: the routine was deleted or the
        // account changed between render and tap, and there is nothing to write.
        if (!row) return false;
        const target = !row.is_favorite;
        applyRoutines(
          routinesRef.current.map((r) => (r.id === routineId ? { ...r, is_favorite: target } : r)),
        );

        setPendingIds((current) => new Set(current).add(routineId));

        const { error: writeError } = await supabase
          .from("routines")
          .update({ is_favorite: target })
          .eq("id", routineId)
          .eq("user_id", userId);

        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(routineId);
          return next;
        });

        if (writeError) {
          applyRoutines(
            routinesRef.current.map((r) =>
              r.id === routineId ? { ...r, is_favorite: !target } : r,
            ),
          );
          setError(writeError.message);
          return false;
        }

        setError(null);
        return true;
      });

      // Registered before awaiting, so a tap arriving during this write chains onto
      // it rather than starting a second one.
      writesInFlight.current.set(routineId, run);
      try {
        return await run;
      } finally {
        // Only clear if this is still the chain's tail: a write queued behind this
        // one has already replaced the entry.
        if (writesInFlight.current.get(routineId) === run) {
          writesInFlight.current.delete(routineId);
        }
      }
    },
    [userId, applyRoutines],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { routines, loading, error, refresh, toggleFavorite, pendingIds };
}

/**
 * Favourite routines, newest first.
 *
 * Derived from the list `useRoutines` already holds rather than issued as its own
 * query: the rows are the same rows, and the home dashboard's card and the library's
 * list are on screen together. A second read of `routines` would be a second copy of
 * the same data that can disagree with the first.
 */
export function useFavorites(userId: string | null) {
  const { routines, loading, error, toggleFavorite, pendingIds } = useRoutines(userId);

  const favorites = useMemo(
    () => routines.filter((r) => r.is_favorite),
    [routines],
  );

  return { favorites, loading, error, toggleFavorite, pendingIds };
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
        .select("log_id,weight,reps,is_warmup")
        .in(
          "log_id",
          sanitizeIds([...ids]),
        );
      for (const row of (setData ?? []) as {
        log_id: string;
        weight: number | null;
        reps: number | null;
        is_warmup: boolean | null;
      }[]) {
        // Warm-up sets are logged for reference but must never count toward
        // set totals, tonnage, or best weight -- they would otherwise inflate
        // every progress metric.
        if (row.is_warmup) continue;
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

/** Volumen con separador de millares, p. ej. `12,557 kg`. */
export function formatVolume(kg: number): string {
  return `${new Intl.NumberFormat("es-MX").format(Math.round(kg))} kg`;
}