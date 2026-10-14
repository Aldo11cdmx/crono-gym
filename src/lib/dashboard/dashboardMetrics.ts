/**
 * dashboardMetrics.ts — pure metrics for the home dashboard.
 *
 * No Supabase, no clock, no localStorage. Every fact is a function of the
 * sessions handed in and the `now` timestamp passed as a parameter, which is
 * what makes every helper fully testable and free of time bombs.
 *
 * The session shape is deliberately minimal: everything the dashboard needs to
 * derive from history without a second query lives here. Heavier derivations
 * -- muscle ranks, fatigue -- read from their own modules.
 */

import { estimateOneRepMax, EXERCISE_METRICS } from "../exercise/exerciseMetrics";
import { BODY_PART_LABELS } from "../i18n";

export { estimateOneRepMax, EXERCISE_METRICS };

/** One working set, flattened with the exercise it belongs to. */
export interface DashboardSet {
  id: string;
  exerciseId: string;
  /** Resolved from the catalog. Falls back to the id when unknown. */
  exerciseName: string;
  weight: number | null;
  reps: number | null;
  /** Warm-ups never count toward PRs, volume, or streaks. */
  isWarmup: boolean;
  /** Body-part label from the catalog, if the set carries it. */
  bodyPart?: string | null;
}

/** One completed workout, with its sets in `set_number` order. */
export interface DashboardSession {
  id: string;
  /** ISO timestamp of the session start. */
  startedAt: string;
  /** ISO timestamp when the session was finished, or null if abandoned. */
  completedAt: string | null;
  routineId: string | null;
  routineTitle: string | null;
  sets: DashboardSet[];
}

/**
 * A personal record set within a window.
 *
 * `estimated1RM` is in kilograms (Epley), per `estimateOneRepMax`. The caller
 * converts to display units.
 */
export interface RecentPR {
  exerciseName: string;
  estimated1RM: number;
  achievedAt: string;
}

/** Consecutive-session streak, split by days and by weeks. */
export interface StreakStats {
  /** Full streak weeks behind the current one. 0 when the user has none. */
  currentWeeks: number;
  /** Consecutive days trained, ending today. 0 when nothing today. */
  currentDays: number;
  /** Longest weekly streak ever observed. */
  longestWeeks: number;
  /** Whether at least one completed session started today (local). */
  trainedToday: boolean;
}

/** One day's volume in the trailing window. */
export interface VolumeTrendPoint {
  /** ISO date string in local calendar time (`YYYY-M-D`). */
  date: string;
  /** `weight * reps` summed over non-warm-up sets, rounded. */
  volumeKg: number;
}

/**
 * The trailing-window trend plus the comparison against the previous window.
 *
 * `deltaPct` is `null` when the previous window has no volume to compare
 * against: "not enough data" and "went up zero percent" are different claims.
 */
export interface VolumeTrendResult {
  points: VolumeTrendPoint[];
  /** Percentage change vs. the preceding `days`-day window, or null. */
  deltaPct: number | null;
}

/** How far through the weekly plan the athlete is. */
export interface WeeklyProgress {
  /** Completed sessions that started this week. */
  completed: number;
  goal: number;
  /** `true` at index `i` when the athlete trained on day `i` (Mon=0..Sun=6). */
  daysTrained: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
}

/** What the dashboard offers as the next routine to train. */
export interface SuggestedRoutine {
  id: string;
  title: string;
  exerciseCount: number;
  /** Rough estimate from exercises + average rest, in minutes. */
  estimatedDurationMin: number;
  /** ISO date of the most recent time this routine was trained, or null. */
  lastDoneAt: string | null;
}

/** The minimal fields the planner rotation needs. */
export interface RoutineSummary {
  id: string;
  title: string;
  exerciseCount: number;
  restSecondsPerExercise: number;
}

/** One day in the weekly planner strip. */
export interface WeeklyPlanDay {
  /** ISO date string in local time (`YYYY-M-D`). */
  date: string;
  /** Full weekday name, e.g. "Lunes". */
  dayName: string;
  /** Routine day label for this calendar day (e.g. "Pecho"), or null. */
  dayLabel: string | null;
  /** True when `now` falls on this calendar day. */
  isToday: boolean;
  /** True when the athlete completed at least one session this day. */
  trained: boolean;
}

/** Full Spanish weekday names, Monday (index 0) through Sunday (index 6). */
const WEEKDAY_NAME_ES = [
  "Lunes",
  "Martes",
  "Miércol",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

/** Returns the 0-based weekday index (Monday = 0) for the given timestamp. */
function weekdayIndex(now: number): number {
  const d = new Date(now);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

/**
 * Resolves the day labels of a multi-day routine into an array indexed by
 * calendar weekday. A routine with N days repeats: Monday maps to day 0,
 * Tuesday to day 1, … and when weekday ≥ N it wraps with modulo.
 *
 * Returns an empty array when the routine has no day labels, which tells the
 * caller to omit labels entirely rather than rendering blanks.
 */
function resolvePlanLabels(
  routines: readonly { dayIndex: number | null | undefined; dayLabel: string | undefined }[],
): string[] {
  const labelByDay = new Map<number, string>();
  for (const r of routines) {
    if (
      r.dayIndex !== null &&
      r.dayIndex !== undefined &&
      r.dayLabel &&
      r.dayLabel.trim() !== ""
    ) {
      labelByDay.set(r.dayIndex, r.dayLabel);
    }
  }
  if (labelByDay.size === 0) return [];

  const maxDay = Math.max(...labelByDay.keys());
  const labels: string[] = [];
  for (let i = 0; i <= maxDay; i++) {
    labels.push(labelByDay.get(i) ?? "");
  }
  return labels;
}

/**
 * Builds the 7-day weekly plan strip.
 *
 * Monday (index 0) through Sunday (index 6), in local calendar order. Each day
 * carries:
 *   - `dayName` — full Spanish weekday name
 *   - `dayLabel` — the routine's focus for that calendar day (e.g. "Pecho"), if
 *     a multi-day routine is available; null otherwise
 *   - `isToday` — whether `now` falls on this calendar day
 *   - `trained` — whether the athlete completed a session on this day
 *
 * `now` is required as a parameter for testability.
 */
export function getWeeklyPlan(
  sessions: readonly DashboardSession[],
  now: number,
  planRoutines: readonly { id: string; dayIndex: number | null | undefined; dayLabel: string | undefined }[] = [],
): WeeklyPlanDay[] {
  const todayIdx = weekdayIndex(now);
  const weekStart = localWeekStart(new Date(now));
  const planLabels = resolvePlanLabels(planRoutines);

  const days: WeeklyPlanDay[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dateKey = localDateKey(day);

    const trained = sessions.some(
      (s) => s.completedAt && localDateKey(new Date(s.startedAt)) === dateKey,
    );

    const dayLabel =
      planLabels.length > 0 ? planLabels[i % planLabels.length] ?? null : null;

    days.push({
      date: dateKey,
      dayName: WEEKDAY_NAME_ES[i],
      dayLabel: dayLabel && dayLabel.trim() !== "" ? dayLabel : null,
      isToday: i === todayIdx,
      trained,
    });
  }

  return days;
}

/**
 * Summary of the athlete's most recent completed session today.
 *
 * Powers the hero's "session completed" state: the title of the routine
 * (or "Sesión libre" for a free session), the wall-clock duration, the
 * number of distinct exercises trained and the number of working sets.
 *
 * Returns null when no session was completed today — the hero then falls
 * back to its scheduled/idle state. A session still in progress
 * (`completedAt === null`) never counts: the hero must not claim a
 * session is finished before it has been persisted as finished.
 *
 * `now` is required as a parameter for testability.
 */
export interface CompletedSessionSummary {
  /** Routine title, or "Sesión libre" when the session had no routine. */
  title: string;
  /** Wall-clock duration in whole minutes, minimum 1. */
  durationMin: number;
  /** Distinct exercises with at least one working set. */
  exerciseCount: number;
  /** Working (non-warm-up) sets completed. */
  setCount: number;
}

export function getCompletedSessionSummary(
  sessions: readonly DashboardSession[],
  now: number,
): CompletedSessionSummary | null {
  const todayKey = localDateKey(new Date(now));
  let latest: DashboardSession | null = null;
  for (const session of sessions) {
    if (!session.completedAt) continue;
    if (localDateKey(new Date(session.startedAt)) !== todayKey) continue;
    if (
      !latest ||
      Date.parse(session.startedAt) > Date.parse(latest.startedAt)
    ) {
      latest = session;
    }
  }
  if (!latest || !latest.completedAt) return null;

  const durationMin = Math.max(
    1,
    Math.round(
      (Date.parse(latest.completedAt) - Date.parse(latest.startedAt)) / 60000,
    ),
  );

  const exercises = new Set<string>();
  let setCount = 0;
  for (const set of latest.sets) {
    if (set.isWarmup) continue;
    exercises.add(set.exerciseId);
    setCount += 1;
  }

  return {
    title: latest.routineTitle ?? "Sesión libre",
    durationMin,
    exerciseCount: exercises.size,
    setCount,
  };
}

// ------------------------------------------------------------------ helpers

/**
 * Starts of the local calendar week (Monday 00:00:00 local).
 *
 * `getDay()` is used rather than the UTC equivalent on purpose: the streak and
 * the weekly progress must align with the athlete's actual calendar, and a
 * UTC week rolls over eight hours too early for an athlete in UTC-8.
 */
function localWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** `YYYY-M-D` in local time, so two sessions on the same calendar day match. */
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Total volume (`weight * reps`) from non-warm-up sets whose session started
 * on `dateKey`, in kilograms.
 */
function volumeForDay(
  sessions: readonly DashboardSession[],
  dateKey: string,
): number {
  let total = 0;
  for (const session of sessions) {
    if (!session.completedAt) continue;
    if (localDateKey(new Date(session.startedAt)) !== dateKey) continue;
    for (const set of session.sets) {
      if (set.isWarmup) continue;
      if (set.weight && set.weight > 0 && set.reps && set.reps > 0) {
        total += set.weight * set.reps;
      }
    }
  }
  return total;
}

// ------------------------------------------------------------------ public

/**
 * Recent personal records, within `windowDays` of `now`.
 *
 * Reuses {@link estimateOneRepMax} rather than reimplementing Epley. A set is
 * a PR when its estimate strictly exceeds the best estimate seen so far for
 * that exercise — equal is held, not broken, matching `isRecordBreak`.
 *
 * Sessions are walked oldest-first so "the best so far" is literally the best
 * of all earlier sessions. A PR is only emitted when the estimate *increases*,
 * so the first working set of an exercise is never a record.
 *
 * Warm-ups, sets with no reps, and sets with more than 10 reps are skipped:
 * Epley is undefined past 10, and the helper must agree with the Records tab
 * rather than inventing a second rule.
 */
export function getRecentPRs(
  sessions: readonly DashboardSession[],
  now: number,
  limit = 3,
  windowDays = 7,
): RecentPR[] {
  const windowStart = now - windowDays * 86_400_000;
  const best = new Map<string, number>();
  const found: RecentPR[] = [];

  for (const session of [...sessions].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
  )) {
    const inWindow = Date.parse(session.startedAt) >= windowStart;

    for (const set of session.sets) {
      if (set.isWarmup) continue;
      if (set.reps === null || set.reps <= 0) continue;
      if (set.reps > EXERCISE_METRICS.MAX_ESTIMATABLE_REPS) continue;
      if (set.weight === null || set.weight <= 0) continue;

      const estimate = estimateOneRepMax(set.weight, set.reps);
      if (estimate === null) continue;

      const current = best.get(set.exerciseId);
      if (current === undefined || estimate > current) {
        if (current !== undefined && inWindow) {
          found.push({
            exerciseName: set.exerciseName,
            estimated1RM: estimate,
            achievedAt: session.startedAt,
          });
        }
        best.set(set.exerciseId, estimate);
      }
    }
  }

  return found
    .sort((a, b) => Date.parse(b.achievedAt) - Date.parse(a.achievedAt))
    .slice(0, limit);
}

/**
 * Consecutive-session streak.
 *
 * Weeks are Monday–Sunday in local time. A week qualifies when it contains at
 * least `weeklyGoal` completed sessions. The week containing `now` does not
 * count toward `currentWeeks` and does not break the streak: an incomplete
 * week is still in progress, not a failure.
 *
 * `currentDays` is a separate daily streak — consecutive days ending today
 * with at least one completed session — which is what shows on the badge for a
 * user who has not yet completed a full week.
 */
export function getStreakStats(
  sessions: readonly DashboardSession[],
  now: number,
  weeklyGoal = 3,
): StreakStats {
  const nowDate = new Date(now);
  const currentWeekStart = localWeekStart(nowDate);
  const currentWeekKey = localDateKey(currentWeekStart);

  /** completed-session count per ISO week key */
  const weekCounts = new Map<string, number>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    const weekKey = localDateKey(localWeekStart(new Date(session.startedAt)));
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
  }

  // Walk backwards from the week before the current one, counting consecutive
  // weeks that meet the goal. The current week is skipped: it is in progress
  // and must not reset the streak to zero.
  let currentWeeks = 0;
  const cursor = new Date(currentWeekStart);
  cursor.setDate(cursor.getDate() - 7);

  for (let i = 0; i < 52; i++) {
    const key = localDateKey(cursor);
    if (key === currentWeekKey) {
      cursor.setDate(cursor.getDate() - 7);
      continue;
    }
    const count = weekCounts.get(key) ?? 0;
    if (count >= weeklyGoal) {
      currentWeeks++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  // Longest streak: same backwards walk, but never breaks on the current week.
  let longestWeeks = 0;
  let running = 0;
  const scan = new Date(currentWeekStart);
  scan.setDate(scan.getDate() - 7);

  for (let i = 0; i < 52; i++) {
    const key = localDateKey(scan);
    const count = weekCounts.get(key) ?? 0;
    if (count >= weeklyGoal) {
      running++;
      longestWeeks = Math.max(longestWeeks, running);
    } else {
      running = 0;
    }
    scan.setDate(scan.getDate() - 7);
  }

  // Daily streak: consecutive days ending today with a completed session.
  let currentDays = 0;
  const dayCursor = new Date(nowDate);
  dayCursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 30; i++) {
    const key = localDateKey(dayCursor);
    const hasSession = sessions.some(
      (s) => s.completedAt && localDateKey(new Date(s.startedAt)) === key,
    );
    if (hasSession) {
      currentDays++;
      dayCursor.setDate(dayCursor.getDate() - 1);
    } else {
      break;
    }
  }

  const todayKey = localDateKey(nowDate);
  const trainedToday = sessions.some(
    (s) => s.completedAt && localDateKey(new Date(s.startedAt)) === todayKey,
  );

  return { currentWeeks, currentDays, longestWeeks, trainedToday };
}

/**
 * Trailing-`days` volume trend with a delta versus the preceding window.
 *
 * Returns one point per calendar day (local time), zero-filled for rest days
 * so the sparkline is a continuous baseline. Warm-ups are excluded — a warm-up
 * set is not volume the athlete chose to accumulate.
 *
 * `deltaPct` is `null` when the previous window has zero volume: comparing
 * against a flat line is not a percentage anyone acts on.
 */
export function getVolumeTrend(
  sessions: readonly DashboardSession[],
  now: number,
  days = 7,
): VolumeTrendResult {
  const nowDate = new Date(now);
  nowDate.setHours(0, 0, 0, 0);

  const points: VolumeTrendPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(nowDate);
    day.setDate(nowDate.getDate() - i);
    const key = localDateKey(day);
    points.push({
      date: key,
      volumeKg: Math.round(volumeForDay(sessions, key)),
    });
  }

  const currentVolume = points.reduce((sum, p) => sum + p.volumeKg, 0);

  // Previous window: the same number of days immediately before this one.
  let prevVolume = 0;
  for (let i = days * 2 - 1; i >= days; i--) {
    const day = new Date(nowDate);
    day.setDate(nowDate.getDate() - i);
    prevVolume += volumeForDay(sessions, localDateKey(day));
  }

  const deltaPct =
    prevVolume > 0
      ? ((currentVolume - prevVolume) / prevVolume) * 100
      : null;

  return { points, deltaPct };
}

/**
 * Weekly plan progress: completed sessions this week and which days were trained.
 *
 * `daysTrained` is a 7-tuple, Monday (index 0) through Sunday (index 6), so the
 * week strip reads left-to-right in calendar order.
 */
export function getWeeklyProgress(
  sessions: readonly DashboardSession[],
  now: number,
  goal = 3,
): WeeklyProgress {
  const weekStart = localWeekStart(new Date(now));
  const daysTrained: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [
    false, false, false, false, false, false, false,
  ];

  let completed = 0;

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const key = localDateKey(day);

    const daySessions = sessions.filter(
      (s) => s.completedAt && localDateKey(new Date(s.startedAt)) === key,
    );

    if (daySessions.length > 0) {
      daysTrained[i] = true;
      completed += daySessions.length;
    }
  }

  return { completed, goal, daysTrained };
}

/**
 * The routine that has been trained the least recently, for rotation.
 *
 * "Never done" beats "done longest ago": a routine with no prior session sorts
 * before any routine that was trained yesterday. Returns `null` when the plan
 * is empty.
 */
export function getNextSuggestedRoutine(
  plan: readonly RoutineSummary[],
  sessions: readonly DashboardSession[],
  now: number,
): SuggestedRoutine | null {
  if (plan.length === 0) return null;

  const lastDone = new Map<string, string>();
  for (const session of sessions) {
    if (!session.completedAt) continue;
    if (!session.routineId) continue;
    // Exclude sessions scheduled in the future (e.g., a planned-but-started-
    // in-the-future log whose timestamp is ahead of `now`).
    if (Date.parse(session.startedAt) > now) continue;
    const existing = lastDone.get(session.routineId);
    if (existing === undefined || session.startedAt > existing) {
      lastDone.set(session.routineId, session.startedAt);
    }
  }

  let best: SuggestedRoutine | null = null;
  let oldest = Infinity;

  for (const routine of plan) {
    const doneAt = lastDone.get(routine.id);
    // `0` means "never done" and wins over any real timestamp.
    const time = doneAt ? Date.parse(doneAt) : 0;
    if (time < oldest || (time === oldest && !best)) {
      oldest = time;
      best = {
        id: routine.id,
        title: routine.title,
        exerciseCount: routine.exerciseCount,
        estimatedDurationMin: estimateDurationMin(routine),
        lastDoneAt: doneAt ?? null,
      };
    }
  }

  return best;
}

/** Rough duration in minutes from exercise count and average rest. */
function estimateDurationMin(routine: RoutineSummary): number {
  const workMin = routine.exerciseCount * 3;
  const restMin = Math.round((routine.restSecondsPerExercise * routine.exerciseCount) / 60);
  return Math.max(15, workMin + restMin);
}

/**
 * Sets per muscle group over the trailing `days`.
 *
 * Returns `null` when no set carries a `bodyPart` value, so the caller can
 * fall back to omitting the section entirely rather than rendering an empty
 * chart. Warm-ups are excluded.
 */
export function getMuscleBalance(
  sessions: readonly DashboardSession[],
  now: number,
  days = 7,
): Record<string, number> | null {
  const windowStart = now - days * 86_400_000;

  const counts: Record<string, number> = {};
  let hasData = false;

  for (const session of sessions) {
    if (Date.parse(session.startedAt) < windowStart) continue;
    if (!session.completedAt) continue;
    for (const set of session.sets) {
      if (set.isWarmup) continue;
      if (!set.bodyPart) continue;
      hasData = true;
      const label = BODY_PART_LABELS[set.bodyPart] ?? set.bodyPart;
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }

  return hasData ? counts : null;
}
