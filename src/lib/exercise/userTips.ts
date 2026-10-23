/**
 * exercise/userTips.ts — the athlete's own technique notes for one exercise.
 *
 * Why localStorage rather than Supabase
 * ------------------------------------------
 * These are personal jottings ("grip is wide on this one"), not data
 * the coach portal reads or another device needs. They follow the
 * `GymSettingsContext` reasoning: a handful of strings read on first
 * paint of the tab, so async storage would mean a frame where the
 * tips section renders empty and then fills -- a flash that reads as
 * a bug. Like gym settings, they are per-device by design.
 *
 * Why per exercise
 * ---------------------
 * A tip about the squat is not a tip about the deadlift, and one
 * global list would grow into a paragraph the athlete has to scan
 * every time they open any exercise. Keyed by exercise id, the list
 * is exactly as long as the movement it belongs to.
 */

/** Storage key prefix, namespaced like `GYM_SETTINGS_KEY`. */
export const USER_TIPS_PREFIX = "cronos:userTips:";

/**
 * The most tips kept for one exercise.
 *
 * A bound, because an append-only list with no ceiling becomes the
 * thing the athlete stops reading. Generous enough to never feel
 * artificial, small enough to stay a list.
 */
export const USER_TIPS_MAX = 24;

/** The longest one tip may be. */
export const USER_TIP_MAX_LENGTH = 280;

/**
 * The user's saved tips for one exercise, oldest first.
 *
 * Corrupt or foreign-shaped storage reads as "no tips yet" rather
 * than throwing: a malformed value in localStorage is a data problem
 * the athlete cannot fix, and the official tips above it still work.
 */
export function loadUserTips(exerciseId: string): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(USER_TIPS_PREFIX + exerciseId);
  } catch {
    // Storage unavailable (private mode, disabled): tips are a
    // convenience, not a promise. Behave as if none were saved.
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((tip): tip is string => typeof tip === "string")
    .map((tip) => tip.trim())
    .filter((tip) => tip.length > 0)
    .slice(0, USER_TIPS_MAX);
}

/**
 * Persists the user's tips for one exercise.
 *
 * Best-effort: a full or unavailable localStorage silently drops the
 * write rather than interrupting the athlete mid-tab.
 */
export function saveUserTips(exerciseId: string, tips: string[]): void {
  try {
    window.localStorage.setItem(
      USER_TIPS_PREFIX + exerciseId,
      JSON.stringify(tips.slice(0, USER_TIPS_MAX)),
    );
  } catch {
    // See `loadUserTips`: durability is a convenience here.
  }
}

/**
 * Normalises a tip the athlete just typed: trimmed, within the
 * length bound, and non-empty -- an empty tip is not a tip.
 * Returns null when the input would not survive the round trip.
 */
export function normaliseUserTip(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, USER_TIP_MAX_LENGTH);
}
