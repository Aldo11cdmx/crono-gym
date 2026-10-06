/**
 * useExerciseHubData.ts — everything one exercise's hub reads, in one place.
 *
 * Three sources, three different shapes, one hook. `ExerciseHub` would otherwise be holding
 * a catalog lookup, a history query and a PR query in the same component body, and the
 * component would stop being about layout.
 *
 * The loading states are deliberately three and not one
 * -----------------------------------------------------
 * `catalog`, `history` and `prs` each report separately, because they fail separately and
 * the athlete can act on the difference. An exercise whose history query fails still shows
 * its demo and its warm-up ramp; collapsing the three into one `loading` would blank the
 * whole screen because a range filter timed out.
 *
 * Which is why this returns `null` for "still loading" and a populated object with
 * `error` set for "loaded and failed", rather than throwing. A hub that cannot load its
 * history still has a demo to show.
 */

import { useEffect, useMemo, useState } from "react";
import { loadExerciseHistory, groupBySession, type ExerciseSession } from "@/lib/exercise/exerciseHistory";
import { sessionMetrics, type SessionMetrics } from "@/lib/exercise/exerciseMetrics";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { useAthletePRs, type AthletePR } from "@/hooks/useAthletePRs";
import type { Exercise } from "@/types/supabase";

export interface ExerciseHubData {
  /** The catalog row, or null while loading or when the id matches nothing. */
  exercise: Exercise | null;
  /** True until the catalog has answered either way. */
  loadingExercise: boolean;
  /** Set when the catalog query itself failed. */
  catalogError: string | null;

  /** Sessions for this exercise, newest first. Empty until history answers. */
  sessions: ExerciseSession[];
  /** Per-session derived metrics, aligned index-for-index with `sessions`. */
  metrics: SessionMetrics[];
  loadingHistory: boolean;
  historyError: string | null;

  /** This exercise's personal record, or null when there is none. */
  pr: AthletePR | null;
  loadingPr: boolean;
}

export function useExerciseHubData(
  userId: string | null,
  exerciseId: string | null | undefined,
): ExerciseHubData {
  const catalog = useExerciseCatalog(userId);
  const prs = useAthletePRs(userId);

  const exercise = useMemo(() => {
    if (!exerciseId) return null;
    return catalog.exercises.find((row) => row.id === exerciseId) ?? null;
  }, [catalog.exercises, exerciseId]);

  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !exerciseId) {
      setSessions([]);
      setHistoryError(null);
      return;
    }

    let live = true;
    setLoadingHistory(true);
    setHistoryError(null);

    void loadExerciseHistory(userId, exerciseId).then((result) => {
      // The guard is not optional: an athlete who taps between two exercises faster than
      // the network answers would otherwise have the slower first response overwrite the
      // second one's data, and the screen would show the wrong exercise's history.
      if (!live) return;
      if (result.ok) {
        setSessions(groupBySession(result.sets));
      } else {
        setSessions([]);
        setHistoryError(result.error);
      }
      setLoadingHistory(false);
    });

    return () => {
      live = false;
    };
  }, [userId, exerciseId]);

  /*
   * `groupBySession` sorts newest-first, and `sessionMetrics` is per session, so the two
   * arrays line up by index. Zipping them here rather than inside the history module
   * because this is the only place that needs both -- and a zip that silently mis-aligns
   * would put one exercise's volume on another's date, which is the sort of wrong that
   * survives review.
   */
  const metrics = useMemo(
    () => sessions.map((session) => sessionMetrics(session.logId, session.startedAt, session.sets)),
    [sessions],
  );

  const pr = useMemo(() => {
    if (!exerciseId) return null;
    return prs.prs.find((row) => row.exerciseId === exerciseId) ?? null;
  }, [prs.prs, exerciseId]);

  return {
    exercise,
    loadingExercise: catalog.loading,
    catalogError: catalog.error,
    sessions,
    metrics,
    loadingHistory,
    historyError,
    pr,
    loadingPr: prs.loading,
  };
}