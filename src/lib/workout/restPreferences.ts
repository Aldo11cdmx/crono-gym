/**
 * workout/restPreferences.ts — how long this athlete rests this exercise.
 *
 * Why localStorage rather than Supabase
 * ------------------------------------------
 * Rest length is a per-device comfort, like the gym's plate inventory: the
 * athlete tunes it on the machine they train on, and a phone that learns
 * "this lifter needs longer on squats" has no business deciding the same
 * for their tablet. It follows the `GymSettingsContext` reasoning -- a
 * handful of numbers read on first use, so async storage would mean a rest
 * that starts at the routine's default and then jumps, which reads as a
 * bug.
 *
 * What writes it
 * ---------------
 * Only the fatigue summary's "30 s más" action, and only for the exercise
 * it appeared under. The routine's own `rest_seconds` stays the source of
 * truth; a preference is an override the athlete asked for, not a default
 * the app invented.
 */

/** Storage key, namespaced like `GYM_SETTINGS_KEY`. */
export const REST_PREFERENCES_KEY = "cronos:restPreferences";

/** The routine default in `ActiveWorkout`, mirrored so a preference can be built on it. */
export const FALLBACK_REST_SECONDS = 90;

/** The step the fatigue summary offers, in seconds. */
export const REST_STEP_SECONDS = 30;

/** The floor any rest is clamped to, in seconds. */
export const REST_FLOOR_SECONDS = 15;

/** The longest rest a preference may ask for, in seconds. */
export const REST_MAX_SECONDS = 600;

/** The per-exercise overrides, as stored. */
type RestPreferences = Record<string, number>;

function read(): RestPreferences {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(REST_PREFERENCES_KEY);
  } catch {
    // Storage unavailable (private mode): every exercise rests as its
    // routine says, which is the honest default anyway.
    return {};
  }
  if (raw === null) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    // Foreign shapes are dropped per-key rather than rejected whole: one
    // corrupted entry is not a reason to forget every other exercise's
    // preference.
    const out: RestPreferences = {};
    for (const [id, seconds] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof seconds === "number" && Number.isFinite(seconds)) {
        out[id] = seconds;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * The rest this exercise should get, in seconds.
 *
 * The athlete's override when there is one and it is within bounds; the
 * routine's default otherwise. A saved value outside bounds is treated as
 * absent rather than clamped silently: a number that far off is a bug's
 * residue, and clamping it would keep the bug's effect around.
 */
export function loadRestSeconds(
  exerciseId: string | null | undefined,
  fallback: number,
): number {
  if (!exerciseId) return fallback;
  const saved = read()[exerciseId];
  if (saved === undefined) return fallback;
  if (saved < REST_FLOOR_SECONDS || saved > REST_MAX_SECONDS) return fallback;
  return saved;
}

/**
 * Remembers a rest length for one exercise, clamped to the bounds the
 * timer itself enforces. Best-effort: a full store drops the write rather
 * than interrupting the athlete mid-session.
 */
export function saveRestSeconds(exerciseId: string, seconds: number): void {
  const clamped = Math.min(Math.max(seconds, REST_FLOOR_SECONDS), REST_MAX_SECONDS);
  const prefs = read();
  prefs[exerciseId] = clamped;
  try {
    window.localStorage.setItem(REST_PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // See `loadRestSeconds`: the routine default is the fallback, not a
    // failure.
  }
}
