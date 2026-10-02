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

/**
 * Cap on sessions pulled in one request.
 *
 * Only applied to the log read, where it also doubles as the page size: two
 * years of training is a few hundred sessions, so one page is normally enough
 * and the loop simply stops after it.
 */
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

/** How many log ids go into one `in.(...)` filter before the URL gets too long. */
const LOG_ID_CHUNK = 50;

/**
 * The response cap the loop below pages against.
 *
 * PostgREST's default `max-rows`, matched here rather than hard-coded at the
 * call sites so a server configured differently only needs changing in one
 * place. Reading exactly this many rows means another page may follow, which is
 * why the loop stops on a short page instead of on a full one.
 */
const ROWS_PER_PAGE = 1000;

/**
 * A paginated read.
 *
 * `error` is a string rather than rethrown so one failed page degrades to a
 * partial load with a visible message, which is recoverable, instead of an
 * empty screen.
 */
interface PagedResult<T> {
  rows: T[];
  error: string | null;
}

/**
 * Value equality for two rank snapshots.
 *
 * Key-by-key rather than serialised: the object is small and short, and this
 * avoids a stringify on every recomputation. Both sides are treated as partial
 * because `unranked` muscles are absent from a snapshot by design.
 */
function sameRanks(a: PreviousRanks, b: PreviousRanks): boolean {
  const left = a as Record<string, RankId | undefined>;
  const right = b as Record<string, RankId | undefined>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

/**
 * The only part of a PostgREST query this file uses.
 *
 * Described structurally, with the rows left as `unknown[]`, rather than
 * importing `PostgrestFilterBuilder`: that type's generic parameters expand with
 * the client version, so naming it here would tie the hook to one release. It
 * also infers the full table row rather than the selected columns, which is why
 * the row type is asserted by the caller instead.
 */
interface RangeQuery {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

/**
 * Reads a query to the end, page by page.
 *
 * PostgREST returns at most `max-rows` per response and signals truncation by
 * returning a full page, not an error. A single unpaginated request therefore
 * looks like success while dropping everything past the cap, which is how a
 * two-year history silently becomes the first thousand rows and a muscle scores
 * on a fraction of its real volume.
 *
 * A short page ends the read. Any error ends it too, keeping the pages already
 * collected so a late failure costs the tail rather than the whole load.
 */
async function fetchAllPages<T>(query: RangeQuery): Promise<PagedResult<T>> {
  const rows: T[] = [];
  let error: string | null = null;

  for (let page = 0; ; page += 1) {
    const from = page * ROWS_PER_PAGE;
    const { data, error: pageError } = await query.range(from, from + ROWS_PER_PAGE - 1);
    if (pageError) {
      error = pageError.message;
      break;
    }
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < ROWS_PER_PAGE) break;
  }

  return { rows, error };
}

/**
 * Fetches every set belonging to the given sessions.
 *
 * The ids are chunked because a two-year history is a four-figure list of uuids
 * and the filter travels in the URL. Every chunk is awaited even after a failure
 * so one bad chunk does not discard the rest.
 */
async function fetchSetsForLogs(logIds: string[]): Promise<PagedResult<CompletedSet>> {
  const rows: CompletedSet[] = [];
  let error: string | null = null;

  for (let i = 0; i < logIds.length; i += LOG_ID_CHUNK) {
    const chunk = logIds.slice(i, i + LOG_ID_CHUNK);
    const page = await fetchAllPages<CompletedSet>(
      supabase
        .from("completed_sets")
        .select("log_id,exercise_id,weight,reps,is_warmup")
        .in("log_id", chunk),
    );
    if (page.error) error = page.error;
    rows.push(...page.rows);
  }

  return { rows, error };
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

    // Logs and sets are read first, because the set query is scoped to the log
    // ids. The other two reads are independent, so they start at the same time.
    const [logsResult, exercisesResult, profileRes] = await Promise.all([
      fetchAllPages<WorkoutLog>(
        supabase
          .from("workout_logs")
          .select("id,started_at,completed_at")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .limit(SESSION_PAGE),
      ),
      fetchAllPages<ExerciseRow>(
        supabase
          .from("exercises")
          .select("id,name,target,body_part,equipment")
          .in("target", Object.keys(TARGETS_WITH_STANDARDS)),
      ),
      supabase.from("profiles").select("weight_kg,sex").eq("user_id", userId).maybeSingle(),
    ]);

    const logs = logsResult.rows;
    if (logsResult.error) setError(logsResult.error);
    if (exercisesResult.error) setError(exercisesResult.error);

    // Sets are fetched without a user filter because `completed_sets` has no
    // user_id column; RLS scopes the rows to the caller's own sessions. Filtering
    // them by log id is therefore both a correctness requirement and a large
    // saving: a busy account would otherwise pull every set on the server.
    //
    // The ids go into `in.(...)`, chunked, because a full history is thousands
    // of uuids and a URL that long is rejected by the server. The client's own
    // row cap is handled by `fetchAllPages`, which is what keeps the score honest:
    // a silently truncated set list scores muscles on a fraction of the real
    // volume and demotes them for no reason the user can see.
    const setsResult = await fetchSetsForLogs(logs.map((l) => l.id));
    const sets = setsResult.rows;
    if (setsResult.error) setError(setsResult.error);

    // Paginated for the same reason as the sets: the catalog already exceeds the
    // 1000-row response cap, so an unpaginated read would drop the tail of the
    // catalog and every set pointing at a dropped exercise would be discarded.
    const exercises = exercisesResult.rows;
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

      // Bail out when the ranks are unchanged, keeping the *same object
      // reference*.
      //
      // This is not an optimisation, it is what stops an infinite loop.
      // `previous` feeds the `map` memo, and the memo returns a fresh object on
      // every run, so setting `previous` unconditionally invalidates the memo,
      // which re-runs this effect, which sets `previous` again. With
      // `persisting` flipped back to false in between, that loop never ends: the
      // measured rate was over 2,000 recomputations in 1.5s, which pins the main
      // thread and makes the whole view look unresponsive. Returning the existing
      // reference lets React skip the re-render and the loop settles after one
      // pass, because the second pass finds nothing to record.
      setPrevious((current) => (sameRanks(current, snapshot) ? current : snapshot));
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