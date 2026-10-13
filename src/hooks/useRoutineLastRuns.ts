/**
 * useRoutineLastRuns.ts — the most recent completed session per routine.
 *
 * A single query that returns the latest `started_at` for each routine the
 * athlete has finished, keyed by routine id. This is the data the library
 * row needs to show "Última vez: hace 3 días" without a per-row N+1.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@lib/supabase";

export interface RoutineLastRun {
  [routineId: string]: string;
}

const SESSION_LIMIT = 50;

export interface RoutineLastRunsState {
  runs: RoutineLastRun;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRoutineLastRuns(userId: string | null): RoutineLastRunsState {
  const [runs, setRuns] = useState<RoutineLastRun>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRuns({});
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("workout_logs")
      .select("routine_id,started_at")
      .eq("user_id", userId)
      .not("routine_id", "is", null)
      .not("completed_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(SESSION_LIMIT);

    if (err) {
      setError(err.message);
      setRuns({});
    } else {
      const map: RoutineLastRun = {};
      for (const log of (data ?? []) as { routine_id: string | null; started_at: string }[]) {
        if (log.routine_id && !map[log.routine_id]) {
          map[log.routine_id] = log.started_at;
        }
      }
      setRuns(map);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { runs, loading, error, refresh };
}
