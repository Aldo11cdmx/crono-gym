/**
 * workout/restTimer.ts — the rest clock, as arithmetic rather than as state.
 *
 * The timer component owns an interval; this module owns what the interval
 * means. Every question the component asks -- "how much is left", "is this
 * the last stretch", "how far around the ring is the hand" -- is answered
 * from a *deadline*, never from a counter, because a counter drifts every
 * time the browser throttles a background tab and a deadline does not: read
 * late, it still names the same moment.
 *
 * Pure on purpose: each function takes `now` (or the numbers it needs) and
 * returns the answer, so the whole clock is testable without a DOM, a
 * timer, or a fake one.
 */

/**
 * How often the clock re-reads the deadline, in ms.
 *
 * Far below one second, so the ring's sweep stays smooth and the numeral
 * turns over at the right moment; far above "every frame", so a resting
 * athlete's battery is not spent painting a number nobody is watching.
 */
export const TICK_MS = 250;

/** The last stretch of a rest, in ms, where the clock changes its voice. */
export const FINAL_STRETCH_MS = 5000;

/** The beep that ends a rest, in Hz. High enough to read as "ready". */
export const REST_BEEP_HZ = 880;

/** How long the end-of-rest beep sounds, in ms. */
export const REST_BEEP_MS = 150;

/** How long a device vibrates when it cannot beep, in ms. */
export const REST_VIBRATE_MS = 200;

/** The step the rest controls adjust by, in ms. */
export const REST_STEP_MS = 15000;

/**
 * Milliseconds left before `endsAt`.
 *
 * Never negative: a deadline in the past is a rest that is over, and "over"
 * is zero, not a number the caller has to remember to clamp.
 */
export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

/**
 * Whether the rest is inside its last five seconds.
 *
 * Zero is excluded: a rest that has ended is not "about to end", and the
 * emphasis is for the moments the athlete can still act on.
 */
export function isFinalStretch(ms: number): boolean {
  return ms > 0 && ms <= FINAL_STRETCH_MS;
}

/**
 * How much of the rest is still ahead, as 0..1.
 *
 * One is "the whole rest ahead" and zero is "no time left", so the
 * ring is full when the rest starts and empties as it runs out --
 * distance the athlete can read at a glance without parsing a numeral.
 */
export function ringProgress(remainingMsValue: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, remainingMsValue / totalMs));
}

/**
 * The clock face, as `mm:ss`.
 *
 * Rounded *up* to the next second, so a rest with 4.2 seconds left reads as
 * "00:05" and flips to "00:04" only once a full second has genuinely gone:
 * a countdown that shows a second before it is spent is a countdown that
 * lies about how long is left.
 */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
