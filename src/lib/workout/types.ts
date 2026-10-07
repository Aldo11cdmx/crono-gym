/**
 * workout/types.ts — shapes that describe a set being logged.
 *
 * Lives here rather than in the component that renders it because it is not a
 * rendering concern. `SetLoggerRow` draws a set, `ActiveWorkout` mutates it and
 * `offlineStore` persists it to IndexedDB and serialises it into the sync queue,
 * so all three depend on this shape and none of them owns it.
 */

import type { SetKind } from "./setKind";

/**
 * One row of the set logger, and the unit everything is stored in.
 *
 * Weight, reps and RPE are **strings**, not numbers, and that is deliberate: this
 * object is the live editing state of a form, and coercing a half-typed `"8."`
 * to a number and back is how a weight field ends up resetting itself while
 * someone is mid-entry. Parsing happens once, at the boundary -- `toNumber()` in
 * `ActiveWorkout.finish()` -- and nowhere else.
 */
export interface SetEntry {
  set_number: number;
  weight: string;
  reps: string;
  rpe: string;
  /**
   * What kind of set this is.
   *
   * A single discriminator rather than a boolean per specialisation: three
   * independent flags (`is_warmup`, `is_failure`, `is_drop`) would admit states
   * that do not exist, like a set that is both a warm-up and a drop set, and
   * nothing would catch it.
   *
   * `is_warmup` is *derived* from this at the persistence boundary so the
   * `completed_sets` column and the sync payload never change shape.
   */
  kind: SetKind;
  completed: boolean;
  /**
   * The athlete's own prose about this set, or null when there is none.
   *
   * Optional and nullable so a draft saved before the field existed --
   * a whole object in the `drafts` store -- reads the same as a set the
   * athlete never annotated: `undefined` and `null` are both "no note",
   * and neither rewrites history. `''` never appears: the normaliser in
   * `setNotes.ts` collapses an emptied field to `null` on purpose, because
   * the `completed_sets` column distinguishes the two and the sync payload
   * only ever carries `null`.
   */
  notes?: string | null;
}
