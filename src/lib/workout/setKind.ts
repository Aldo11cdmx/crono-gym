/**
 * setKind.ts — what kind of set a row is.
 *
 * Pure, no React. Every fact the app needs about the four kinds lives here rather
 * than in the chip row that renders them, because the *same* questions get asked
 * in three places that would otherwise each grow their own answer:
 *
 * - `SetLoggerRow` to draw the chips.
 * - `ActiveWorkout.finish()` to decide what counts as a working set.
 * - `offlineStore` to read a draft that was written by an older build.
 *
 * Order is the order the chips appear in, and it is deliberate: `normal` first
 * because it is what most sets are, then the two that change the intent of the
 * weight, then the two techniques.
 */

import type { SetEntry } from "./types";

export type SetKind = "normal" | "warmup" | "failure" | "drop";

export const SET_KINDS: readonly SetKind[] = ["normal", "warmup", "failure", "drop"];

export function isSetKind(value: unknown): value is SetKind {
  return typeof value === "string" && (SET_KINDS as readonly string[]).includes(value);
}

/**
 * Whether this set is real work, for tonnage, PRs and the progress chart.
 *
 * Only warm-ups are excluded. A failure set and a drop set are performed on
 * purpose and their load is real; counting them as volume is the whole reason
 * people track them.
 */
export function countsAsWorkingSet(kind: SetKind): boolean {
  return kind !== "warmup";
}

/**
 * The `completed_sets.is_warmup` value for a kind.
 *
 * The database only has a boolean, and it has had one since before drop sets and
 * failure sets existed. Rather than a migration for a column that is already
 * sufficient, the richer kind stops at this boundary.
 */
export function toWarmupColumn(kind: SetKind): boolean {
  return kind === "warmup";
}

/**
 * Rebuilds a `SetEntry` from whatever came out of storage.
 *
 * Two reasons this cannot just be a cast:
 *
 * 1. Drafts written by an earlier build have `is_warmup: boolean` and no `kind`.
 *    Reading those without this would leave `kind` undefined and the chip row
 *    would render nothing selected.
 * 2. IndexedDB is durable. A field written once will be read for as long as the
 *    user trains on this device, so "old shape" is not a hypothetical.
 *
 * Unknown or missing numbers fall back to empty strings rather than throwing,
 * because losing a session's weight on an upgrade is not recoverable.
 */
export function normalizeSetEntry(raw: unknown, index: number): SetEntry {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;

  const legacyWarmup = source.is_warmup === true;
  const kind: SetKind = isSetKind(source.kind)
    ? source.kind
    : legacyWarmup
      ? "warmup"
      : "normal";

  return {
    set_number:
      typeof source.set_number === "number" && Number.isFinite(source.set_number)
        ? source.set_number
        : index + 1,
    weight: typeof source.weight === "string" ? source.weight : "",
    reps: typeof source.reps === "string" ? source.reps : "",
    rpe: typeof source.rpe === "string" ? source.rpe : "",
    kind,
    completed: source.completed === true,
    /*
     * The note travels with the set it belongs to.
     *
     * It used to be dropped here, and the draft was where that showed: a set
     * written with a note came back out of storage without it, so the session
     * the athlete could recover was not the session they had left. A note is
     * prose about one attempt at one weight -- "the grip gave out at rep 7" --
     * and there is no other place for it to live.
     *
     * `undefined` rather than `null` when there is none: the two mean the same
     * thing to the reader, and `undefined` leaves the shape of a set that never
     * had a note identical to the shape it had before the field existed.
     */
    notes: typeof source.notes === "string" ? source.notes : undefined,
  };
}
