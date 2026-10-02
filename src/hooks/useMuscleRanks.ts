/**
 * useMuscleRanks.ts — loads training history, computes the rank map, keeps the
 * timeline.
 *
 * Reads from Supabase rather than IndexedDB. The offline store holds drafts and
 * a pending queue, not history: it exists so finishing a workout never depends on
 * the network. Rank history needs the *whole* record, which only the server has.
 * The ranks' own state (timeline, last ranks) is cached in IndexedDB because it
 * must survive a reload for hysteresis to work.
 *
 * Reactivity comes from `subscribeTrainingData`, fired by `sessionSync` after a
 * session reaches the server. Finishing a workout therefore updates the map
 * without a reload or a poll. The trade-off is explicit: a session logged on
 * another device is not seen until the tab reloads. Supabase realtime is the fix
 * and is not implemented -- see the TODO in `trainingEvents`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@lib/supabase";
import type { CompletedSet, WorkoutLog } from "@/types/supabase";
import { subscribeTrainingData } from "../lib/trainingEvents";
import {
  appendRankHistory,
  isoDay,
  loadLastRanks,
  loadRankHistory,
  saveLastRanks,
  type RankHistoryRecord,
} from "../lib/ranks/rankHistory";
import {
  buildRankMap,
  historyEntriesFor,
  promotionsIn,
  rankDistribution,
  sessionsUntilFirstRank,
  shouldShowEmptyState,
  snapshotRanks,
  type MuscleRank,
  type PreviousRanks,
  type RankHistoryEntry,
  type RankMap,
} from "../lib/ranks/buildRankMap";
import { muscleMatchLevel } from "../lib/muscleMap";
import type { ExerciseRow, SetRow } from "../lib/ranks/muscleScore";
import { ELIGIBILITY, type RankId, type SexKey } from "../lib/ranks/rankConfig";

/**
 * How far back to read sessions.
 *
 * Two years, which is the brief's performance target. Older sessions cannot
 * change a score: the volume window is 90 days and the strength component takes
 * each exercise's *best ever* 1RM, which two years of history has already
 * captured. Reading further would only cost bytes.
 */
const HISTORY_DAYS = 730;

/** Cap on sessions pulled in one request; PostgREST caps rows per response. */
const SESSION_PAGE = 1000;

export interface MuscleRanksState {
  map: RankMap | null;
  /** Rank timeline, oldest first, across all muscles. */
  history: RankHistoryRecord[];
  /** Muscles that gained a rank in the most recent computation. */
  promotions: MuscleRank[];
  loading: boolean;
  /** True only for the first load, so the skeleton does not flash on updates. */
  initialLoading: boolean;
  error: string | null;
  /** Sessions still needed before anything can be ranked. */
  sessionsNeeded: number;
  /** True when no muscle has enough data yet. */
  empty: boolean;
  distribution: Record<RankId, number>;
  /**
   * Bodyweight used for the ratios, or null when the profile has none.
   *
   * Exposed because "why is nothing ranked" is very often "you have not entered
   * your bodyweight", which is actionable in a way the empty state alone is not.
   */
  bodyweightKg: number | null;
  /** Timeline for one muscle, or an empty list. */
  historyFor: (slug: string) => RankHistoryRecord[];
  /** Forces a refetch, e.g. after the user edits the bodyweight. */
  refresh: () => Promise<void>;
}

/** Raw rows as they arrive from the two tables. */
interface HistoryRows {
  logs: WorkoutLog[];
  /** Sets already normalised to the scorer's shape. */
  sets: SetRow[];
  exercises: ExerciseRow[];
}

/** Nothing to show yet, so the UI can render a skeleton instead of `null`. */
const EMPTY_DISTRIBUTION = {} as Record<RankId, number>;

export function useMuscleRanks(userId: string | null): MuscleRanksState {
  const [rows, setRows] = useState<HistoryRows>({ logs: [], sets: [], exercises: [] });
  const [previous, setPrevious] = useState<PreviousRanks>({});
  const [history, setHistory] = useState<RankHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bodyweightKg, setBodyweightKg] = useState<number | null>(null);
  const [sex, setSex] = useState<SexKey>("other");

  /**
   * Guards the compute-and-persist effect.
   *
   * Hysteresis is stateful: each computation writes the ranks it produced, and
   * the next run reads them. Two overlapping runs would interleave, and the
   * second could store ranks computed against a stale previous map. This ref
   * makes the effect strictly sequential.
   */
  const persisting = useRef(false);

  const load = useCallback(async () => {
    if (!userId) {
      setRows({ logs: [], sets: [], exercises: [] });
      setPrevious({});
      setHistory([]);
      setLoaded(false);
      return;
    }

    setLoading(true);
    setError(null);

    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();

    // The three reads are independent; one failure should not hide the others,
    // so each result is handled separately rather than through a single Promise
    // that rejects on the first failure.
    const [logsRes, setsRes, exercisesRes, profileRes] = await Promise.all([
      supabase
        .from("workout_logs")
        .select("id,started_at,completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(SESSION_PAGE),
      supabase.from("completed_sets").select("log_id,exercise_id,weight,reps,is_warmup"),
      supabase
        .from("exercises")
        .select("id,name,target,body_part,equipment")
        .in("target", Object.keys(TARGETS_WITH_STANDARDS)),
      supabase.from("profiles").select("weight_kg,sex").eq("user_id", userId).maybeSingle(),
    ]);

    const logs = (logsRes.data ?? []) as WorkoutLog[];

    if (logsRes.error) setError(logsRes.error.message);
    if (setsRes.error) setError(setsRes.error.message);
    if (exercisesRes.error) setError(exercisesRes.error.message);

    // Sets are fetched without a user filter because `completed_sets` has no
    // user_id column; RLS scopes the rows to the caller's own sessions. Filtering
    // them here by log id is therefore both a correctness requirement and a large
    // saving: a busy account would otherwise pull every set on the server.
    const logIds = new Set(logs.map((l) => l.id));
    const sets = ((setsRes.data ?? []) as CompletedSet[]).filter((s) =>
      logIds.has(s.log_id),
    );

    const exercises = (exercisesRes.data ?? []) as ExerciseRow[];
    const catalog = new Map(exercises.map((e) => [e.id, e]));

    // Attach each set's session timestamp; the scorer needs it for the decay and
    // week-window maths, and `completed_sets` does not carry the date itself.
    const startedAt = new Map(logs.map((l) => [l.id, l.started_at]));
    const enriched: SetRow[] = [];
    for (const set of sets) {
      const exercise = catalog.get(set.exercise_id);
      if (!exercise) continue;
      enriched.push({
        exerciseId: set.exercise_id,
        weight: set.weight,
        reps: set.reps,
        isWarmup: set.is_warmup,
        performedAt: startedAt.get(set.log_id) ?? new Date(0).toISOString(),
      });
    }

    const profile = profileRes.data as { weight_kg: number | null; sex: string | null } | null;
    if (!profileRes.error && profile) {
      setBodyweightKg(profile.weight_kg);
      setSex(normalizeSex(profile.sex));
    }

    setRows({ logs, sets: enriched, exercises });
    setLoading(false);
    setLoaded(true);
  }, [userId]);

  // Initial load plus the stored hysteresis state. The history read has to land
  // before the first computation so a reload does not treat every rank as new.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await loadLastRanks();
      if (!alive) return;
      setPrevious(stored as PreviousRanks);
      setHistory(await loadRankHistory());
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  // Recompute whenever written training data lands, without a reload.
  useEffect(() => {
    if (!userId) return;
    return subscribeTrainingData(() => {
      void load();
    });
  }, [userId, load]);

  const map = useMemo(() => {
    if (!loaded || rows.exercises.length === 0) return null;
    return buildRankMap({
      sets: rows.sets,
      exercises: rows.exercises,
      context: { bodyweightKg, sex, now: new Date() },
      previous,
    });
  }, [loaded, rows, bodyweightKg, sex, previous]);

  // Persist the ranks and the timeline once per distinct map.
  useEffect(() => {
    if (!map || persisting.current) return;
    persisting.current = true;
    void (async () => {
      const snapshot = snapshotRanks(map);
      const scores: Record<string, number> = {};
      for (const [slug, entry] of map.muscles) scores[slug] = entry.score;

      await saveLastRanks(
        Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, v])),
        scores,
      );

      // Only actual rank changes are recorded, so the timeline stays sparse and
      // meaningful rather than becoming a log of every recalculation.
      const entries: RankHistoryEntry[] = historyEntriesFor(map, previous, new Date());
      if (entries.length > 0) {
        const day = isoDay();
        await appendRankHistory(
          entries.map((e) => ({
            slug: e.slug,
            rank: e.rank,
            score: e.score,
            recordedAt: e.recordedAt,
            day,
          })),
        );
        setHistory(await loadRankHistory());
      }

      setPrevious(snapshot);
      persisting.current = false;
    })();
  }, [map, previous]);

  const promotions = useMemo(() => (map ? promotionsIn(map) : []), [map]);
  const distribution = useMemo(
    () => (map ? rankDistribution(map) : EMPTY_DISTRIBUTION),
    [map],
  );

  const historyFor = useCallback(
    (slug: string) => history.filter((h) => h.slug === slug),
    [history],
  );

  const empty = map ? shouldShowEmptyState(map) : true;
  const sessionsNeeded = map ? sessionsUntilFirstRank(map) : ELIGIBILITY.minSessions;

  return {
    map,
    history,
    promotions,
    loading,
    initialLoading: loading && !loaded,
    error,
    sessionsNeeded,
    empty,
    distribution,
    bodyweightKg,
    historyFor,
    refresh: load,
  };
}

/**
 * Only catalog targets with a strength standard can produce a score, so the query
 * filters to them. Without this the ranks view would ship 1,324 exercise rows to
 * score sixteen muscles.
 */
const TARGETS_WITH_STANDARDS: Record<string, true> = {
  glutes: true,
  quads: true,
  hamstrings: true,
  "lower back": true,
  spine: true,
  pectorals: true,
  "upper back": true,
  lats: true,
  traps: true,
  delts: true,
  triceps: true,
  biceps: true,
  forearms: true,
  abs: true,
  obliques: true,
  adductors: true,
  calves: true,
};

/** Profile `sex` is a free string in the DB; anything unexpected scores neutral. */
function normalizeSex(value: string | null): SexKey {
  if (value === "male" || value === "female" || value === "other") return value;
  return "other";
}

/** Re-exported so the view imports the match helper from one place. */
export { muscleMatchLevel };
export type { RankId };