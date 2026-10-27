/**
 * heroCardModel.ts — pure helpers for the dashboard hero.
 *
 * No Date.now() inside: every function that needs a timestamp receives `now`
 * as an explicit argument, so time is testable and deterministic.
 */

export interface RoutineSummary {
  title: string;
  exerciseCount: number;
  estimatedDurationMin: number;
  /** Lowercase body-part slugs, e.g. ["chest", "shoulders"]. */
  muscles?: string[];
  /** Day label for this routine's day (e.g. "Pecho"), or empty when unnamed. */
  dayLabel?: string;
  /** Which day of the routine this is (0-based), or null when single-day. */
  dayIndex?: number | null;
}

/** Short Spanish day-name abbreviations, Monday (index 0) through Sunday (index 6). */
export const WEEKDAY_SHORT_ES = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Full Spanish weekday names in local calendar order (Monday index 0).
 *
 * `Intl.DateTimeFormat` returns names in the user's locale, but the dashboard
 * is Spanish-first and this avoids a dependency on the runtime locale for a
 * fixed 7-item list.
 */
export const WEEKDAY_NAME_ES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

/**
 * Formats the hero card subtitle metrics without repeating the routine title.
 *
 * Examples:
 *   formatSessionMeta(3, 15) -> "3 ejercicios • 15 min"
 *   formatSessionMeta(1, null) -> "1 ejercicio"
 *   formatSessionMeta(0, 5) -> "0 ejercicios • ~5 min" (when estimated)
 */
export function formatSessionMeta(
  exerciseCount: number,
  minutes: number | null,
  estimated = false,
): string {
  const ex = exerciseCount === 1 ? "1 ejercicio" : `${exerciseCount} ejercicios`;
  if (minutes === null) return ex;
  const min = estimated ? `~${minutes} min` : `${minutes} min`;
  return `${ex} • ${min}`;
}
export function getWeekdayIndex(now: number): number {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday
  return day === 0 ? 6 : day - 1;
}

/**
 * Resolves the day labels of a multi-day routine into an array indexed by
 * day index.
 *
 * Each entry in `entries` represents one day of one routine. This function
 * collects them into a map keyed by dayIndex, then returns the labels in
 * index order so the caller can map a calendar weekday → label via modulo.
 *
 * Returns an empty array when no entry carries a day label, which tells the
 * caller to omit labels entirely rather than rendering blanks.
 */
function resolveDayLabels(
  entries: readonly {
    dayIndex: number | null | undefined;
    dayLabel: string | undefined;
  }[],
): string[] {
  const labelByDay = new Map<number, string>();
  for (const entry of entries) {
    if (
      entry.dayIndex !== null &&
      entry.dayIndex !== undefined &&
      entry.dayLabel &&
      entry.dayLabel.trim() !== ""
    ) {
      labelByDay.set(entry.dayIndex, entry.dayLabel);
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
 * Daily focus for the hero card.
 *
 * Determines today's calendar day name and, when the routine plan has day
 * labels, the label (body-part focus) for today. A rest day is inferred from
 * whether the athlete completed a session today.
 *
 * `dayEntries` is a flat list of `{ dayIndex, dayLabel }` — one per day across
 * all routines — so that a multi-day routine's days are available for the
 * weekday→label mapping. Pass `[]` when no plan exists; `dayLabel` will be null.
 *
 * `now` is required as a parameter for testability.
 */
export interface DailyFocus {
  /** Full weekday name, e.g. "Sábado". */
  dayName: string;
  /** Day label from the routine (e.g. "Pecho"), or null when no plan exists. */
  dayLabel: string | null;
  /** True when the athlete already trained today — render rest-day state. */
  isRestDay: boolean;
}

export function getDailyFocus(
  dayEntries: readonly {
    dayIndex: number | null | undefined;
    dayLabel: string | undefined;
  }[],
  sessions: ReadonlyArray<{ startedAt: string; completedAt: string | null }>,
  now: number,
  trainedToday?: boolean,
): DailyFocus {
  const weekday = getWeekdayIndex(now);
  const dayName = WEEKDAY_NAME_ES[weekday];

  let dayLabel: string | null = null;
  const labels = resolveDayLabels(dayEntries);
  if (labels.length > 0) {
    const idx = weekday % labels.length;
    const label = labels[idx];
    if (label && label.trim() !== "") dayLabel = label;
  }

  // If `trainedToday` is passed directly, use it; otherwise derive from sessions.
  let isRestDay: boolean;
  if (trainedToday !== undefined) {
    isRestDay = trainedToday;
  } else {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayKey = localDateKey(today);
    isRestDay = sessions.some(
      (s) => s.completedAt && localDateKey(new Date(s.startedAt)) === todayKey,
    );
  }

  return { dayName, dayLabel, isRestDay };
}

/** `YYYY-M-D` in local time, so two sessions on the same calendar day match. */
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const MAX_NAME_LENGTH = 20;

/**
 * Builds a time-of-day greeting in the LOCAL timezone of `now`.
 *
 *  05:00–11:59  → "Buenos días"
 *  12:00–17:59  → "Buenas tardes"
 *  18:00–04:59  → "Buenas noches"
 *
 * When a name is provided it is trimmed, and only the part before the first
 * whitespace is used so "Ana María" → "Ana". Long names are truncated to
 * MAX_NAME_LENGTH characters (no ellipsis — the caller decides punctuation).
 *
 * Without a name the greeting stands alone: "Buenos días".
 * The name is never sent to the IA.
 */
export function getGreeting(now: number, name: string | null | undefined): string {
  const date = new Date(now);
  // getHours works in local time per spec; no manual offset math needed.
  const hour = date.getHours();

  let part: string;
  if (hour >= 5 && hour < 12) {
    part = "Buenos días";
  } else if (hour >= 12 && hour < 18) {
    part = "Buenas tardes";
  } else {
    part = "Buenas noches";
  }

  if (!name) return part;

  const trimmed = name.trim();
  if (trimmed === "") return part;

  const firstName = trimmed.split(/[\s_]+/)[0] ?? "";
  if (firstName === "") return part;

  const displayName = firstName.length > MAX_NAME_LENGTH
    ? firstName.slice(0, MAX_NAME_LENGTH)
    : firstName;

  const capitalized = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();

  return `${part}, ${capitalized}`;
}
