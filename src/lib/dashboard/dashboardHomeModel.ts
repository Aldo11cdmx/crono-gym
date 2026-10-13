/**
 * dashboardHomeModel.ts — the single data model DashboardPage composes from.
 *
 * Orchestrates the hooks (profile, sessions, routines, active session) and the
 * pure metric helpers into one DashboardHomeData object. The page itself is
 * pure composition: it reads from this model and renders components.
 *
 * All time-dependent computation uses a single `now` captured at the top,
 * matching the `now`-as-parameter convention from dashboardMetrics.ts and
 * heroCardModel.ts.
 */

import { useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useDashboardSessions } from "@/hooks/useDashboardSessions";
import { useRoutines } from "@/hooks/useGymData";
import { useActiveSession } from "@/context/ActiveSessionContext";
import type { ActiveSession } from "@/context/ActiveSessionContext";
import { countMuscleSets } from "@/components/MuscleReadonlyMap";
import type { Slug } from "react-muscle-highlighter";

import {
  getWeeklyPlan,
  getWeeklyProgress,
  getStreakStats,
  getVolumeTrend,
  getRecentPRs,
  getNextSuggestedRoutine,
  type WeeklyPlanDay,
  type WeeklyProgress,
  type StreakStats,
  type VolumeTrendResult,
  type RecentPR,
  type SuggestedRoutine,
  type RoutineSummary as MetricsRoutineSummary,
} from "@/lib/dashboard/dashboardMetrics";

import {
  getDailyFocus,
  getGreeting,
  type DailyFocus,
  type RoutineSummary as HeroRoutineSummary,
} from "@/lib/dashboard/heroCardModel";

/**
 * The complete data model for the dashboard home screen.
 *
 * Produced by {@link useDashboardHome} by composing the hooks and the pure
 * metric helpers. DashboardPage reads this single object and renders — no
 * further computation happens in the component.
 */
export interface DashboardHomeData {
  /** True while any data source is still loading. */
  loading: boolean;
  /** Per-source error messages, keyed by source name. */
  readonly errors: Record<string, string | null>;
  /** Refresh all data sources at once. */
  refreshAll: () => Promise<void>;

  // ---- Profile (for greeting + unit formatting) ----
  /** Display name for the greeting, or null. */
  displayName: string | null;
  /** "metric" or "imperial" — the profile's unit-system preference. */
  unitSystem: "metric" | "imperial";

  // ---- Hero section ----
  /** e.g. "Buenos días, Ana" or just "Buenas tardes". */
  greeting: string;
  /** Today's calendar day name and routine focus label. */
  dailyFocus: DailyFocus;
  /** Suggested routine summary for hero chips, or null when no plan exists. */
  heroRoutineSummary: HeroRoutineSummary | null;
   /** Suggested routine (with id) for starting a session, or null. */
  suggestedRoutine: SuggestedRoutine | null;
  /** Muscle distribution for the suggested routine (set counts per slug), or null. */
  muscleCounts: Map<Slug, number> | null;
  /** Active workout session from context, or null. */
  activeSession: ActiveSession | null;
  /** True when a workout is currently in progress. */
  isSessionActive: boolean;
  /** Start a new workout session with an optional routine. */
  startSession: (routine: { id: string; title: string } | null) => void;
  /** End the current workout session (idempotent). */
  endSession: () => void;

  // ---- Weekly plan strip ----
  /** Seven days, Monday-first, with day labels and trained flags. */
  weeklyPlan: WeeklyPlanDay[];

  // ---- Weekly progress ----
  /** Completed sessions this week vs. goal + days trained tuple. */
  weeklyProgress: WeeklyProgress;

  // ---- Streak & volume ----
  /** Daily/weekly streak stats computed from session history. */
  streakStats: StreakStats | null;
  /** Seven-day volume trend with delta percentage. */
  volumeTrend: VolumeTrendResult | null;

  // ---- Recent PRs ----
  /** Top N recent personal records (default 3) within the look-back window. */
  recentPRs: RecentPR[];
}

/** Default weekly session goal. */
const WEEKLY_GOAL = 3;
const PR_LIMIT = 3;
const PR_WINDOW_DAYS = 7;
const VOLUME_DAYS = 7;

/**
 * The dashboard's single data hook.
 *
 * Calls the four data hooks, feeds the session + routine data through the pure
 * metric helpers, and returns one composed object.
 *
 * When any source is loading, `loading` is true and the caller should render
 * skeletons. Metric values are still computed from whatever data is present
 * (even if empty) so the model is always in a consistent state.
 */
export function useDashboardHome(userId: string | null): DashboardHomeData {
  // ---- Data sources ----
  const profileState = useProfile(userId);
  const sessionsState = useDashboardSessions(userId);
  const routinesState = useRoutines(userId);
  const activeSessionValue = useActiveSession();

  const { profile } = profileState;
  const { sessions } = sessionsState;
  const { routines } = routinesState;

  // ---- Single time reference for all pure functions ----
  const now = useMemo(() => Date.now(), []);

  // ---- Derive planner inputs from RoutineWithExercises[] ----
  // planRoutines: flat list of { id, dayIndex, dayLabel } — one per routine_exercise row
  //   that carries day info. Used by getWeeklyPlan and getDailyFocus.
  // planSummary:  RoutineSummary[] (metrics shape) for getNextSuggestedRoutine.
  const { planRoutines, planSummary } = useMemo(() => {
    const planRoutines: {
      id: string;
      dayIndex: number | null | undefined;
      dayLabel: string | undefined;
    }[] = [];

    for (const routine of routines) {
      for (const ex of routine.exercises) {
        if (ex.dayIndex !== null && ex.dayIndex !== undefined) {
          planRoutines.push({
            id: routine.id,
            dayIndex: ex.dayIndex,
            dayLabel: ex.dayLabel,
          });
        }
      }
    }

    const planSummary: MetricsRoutineSummary[] = routines.map((r) => ({
      id: r.id,
      title: r.title,
      exerciseCount: r.exercises.length,
      restSecondsPerExercise:
        r.exercises.length > 0
          ? Math.round(
              r.exercises.reduce(
                (sum, e) => sum + (e.rest_seconds ?? 90),
                0,
              ) / r.exercises.length,
            )
          : 90,
    }));

    return { planRoutines, planSummary };
  }, [routines]);

  // ---- Streak (needed first: trainedToday feeds getDailyFocus) ----
  const streakStats = useMemo(
    () => getStreakStats(sessions, now, WEEKLY_GOAL),
    [sessions, now],
  );

  // ---- Daily focus (day name + routine label for today) ----
  const dailyFocus = useMemo(
    () =>
      getDailyFocus(
        planRoutines,
        sessions,
        now,
        streakStats.trainedToday,
      ),
    [planRoutines, sessions, now, streakStats.trainedToday],
  );

  // ---- Weekly plan strip (Mon→Sun) ----
  const weeklyPlan = useMemo(
    () => getWeeklyPlan(sessions, now, planRoutines),
    [sessions, now, planRoutines],
  );

  // ---- Weekly progress (completed vs goal + days trained) ----
  const weeklyProgress = useMemo(
    () => getWeeklyProgress(sessions, now, WEEKLY_GOAL),
    [sessions, now],
  );

  // ---- Volume trend (7-day sparkline + delta) ----
  const volumeTrend = useMemo(
    () => getVolumeTrend(sessions, now, VOLUME_DAYS),
    [sessions, now],
  );

  // ---- Recent PRs (computed from session history, no extra fetch) ----
  const recentPRs = useMemo(
    () => getRecentPRs(sessions, now, PR_LIMIT, PR_WINDOW_DAYS),
    [sessions, now],
  );

  // ---- Suggested routine ----
  const suggestedRoutine = useMemo(
    () => getNextSuggestedRoutine(planSummary, sessions, now),
    [planSummary, sessions, now],
  );

  // ---- Muscle counts for the suggested routine ----
  const muscleCounts = useMemo(() => {
    if (!suggestedRoutine) return null;
    const fullRoutine = routines.find((r) => r.id === suggestedRoutine.id);
    if (!fullRoutine) return null;
    return countMuscleSets(fullRoutine.exercises);
  }, [suggestedRoutine, routines]);

  // ---- Convert SuggestedRoutine → HeroRoutineSummary for hero chips ----
  const heroRoutineSummary = useMemo((): HeroRoutineSummary | null => {
    if (!suggestedRoutine) return null;
    return {
      title: suggestedRoutine.title,
      exerciseCount: suggestedRoutine.exerciseCount,
      estimatedDurationMin: suggestedRoutine.estimatedDurationMin,
      dayLabel: dailyFocus.dayLabel ?? undefined,
      dayIndex: null,
    };
  }, [suggestedRoutine, dailyFocus.dayLabel]);

  // ---- Greeting ----
  const greeting = useMemo(
    () => getGreeting(now, profile?.display_name ?? null),
    [now, profile?.display_name],
  );

  // ---- Aggregate loading / errors ----
  const loading =
    profileState.loading ||
    sessionsState.loading ||
    routinesState.loading;

  const errors: Record<string, string | null> = {
    profile: profileState.error,
    sessions: sessionsState.error,
    routines: routinesState.error,
  };

  const refreshAll = useMemo(
    () =>
      async () => {
        await Promise.all([
          profileState.refresh(),
          sessionsState.refresh(),
          routinesState.refresh(),
        ]);
      },
    [profileState.refresh, sessionsState.refresh, routinesState.refresh],
  );

  return {
    loading,
    errors,
    refreshAll,
    displayName: profile?.display_name ?? null,
    unitSystem: profile?.unit_system ?? "metric",
    greeting,
    dailyFocus,
    heroRoutineSummary,
    suggestedRoutine,
    muscleCounts,
    activeSession: activeSessionValue.session,
    isSessionActive: activeSessionValue.isActive,
    startSession: activeSessionValue.start,
    endSession: activeSessionValue.end,
    weeklyPlan,
    weeklyProgress,
    streakStats,
    volumeTrend,
    recentPRs,
  };
}
