/**
 * supersetUtils.ts — where an exercise sits inside its superset.
 *
 * A superset is a group of exercises performed back to back: "A then B, then
 * A again". The relationship already travels through the app as `groupId` -- it
 * comes off the routine, survives the clone into the session, and is stored in
 * the draft -- but nothing yet *reads* it. This module is the one place that
 * does, so the strip, the badge and the automatic advance all agree on what
 * "the group" is.
 *
 * Three questions, three functions
 * ---------------------------------
 * - **Which group is this, and where am I in it?** `getSupersetInfo` answers it
 *   with the label the athlete reads ("A"), the position inside the group
 *   ("1 of 2") and the colour the group is painted in.
 * - **Where do I go next?** `getNextSupersetTargetIndex` answers it with the
 *   index of the next exercise of the same group, or -1 when there is none.
 *
 * Why the label is A, B, C
 * -----------------------
 * The group id is an opaque string -- a uuid from the database, or a slug from
 * an import. It means nothing to a person. The label is assigned by *order of
 * appearance*: the first group in the list is A, the second is B, and so on.
 * That is stable for a given list, which is what a label has to be, and it is
 * assigned the same way in every session.
 *
 * Why the colour is derived from the group id
 * -------------------------------------------
 * The colour is a hash of the group id, so the same group is the same colour
 * everywhere it appears -- in the strip, in the badge, in the bar. A colour
 * assigned by position would change when the athlete reorders the strip, and a
 * colour that changes under the finger is a colour the athlete stops trusting.
 *
 * The hash can land two groups on the same colour, and that is accepted: a
 * collision costs a distinction between two *groups*, while the position and
 * the label still tell them apart. The alternative -- assigning by position --
 * would make the colour change for reasons the athlete did not cause.
 */

import { SUPERSET, type SupersetTone } from "@/design/tokens";

/**
 * The minimum an exercise has to say for this module to place it.
 *
 * Structural on purpose: the session's `DraftExercise`, the carousel's
 * `CarouselItem` and a test fixture all satisfy it without a cast, and none of
 * them has to import anything from here to do so.
 */
export interface SupersetExercise {
  /** The superset this exercise belongs to, or null when it stands alone. */
  groupId?: string | null;
}

/** Everything the strip needs to draw one exercise's place in its group. */
export interface SupersetInfo {
  /** The group this exercise belongs to. */
  groupId: string;
  /** The letter the group is labelled with: "A", "B", "C"... */
  label: string;
  /** Where this exercise sits in the group, counting from 1. */
  position: number;
  /** How many exercises the group holds. */
  total: number;
  /** The colour the group is painted in, as a hex. */
  color: string;
  /** The tints that go with that colour. */
  tone: SupersetTone;
  /** True for the first exercise of the group. */
  isFirst: boolean;
  /** True for the last one. */
  isLast: boolean;
}

/**
 * Where an exercise sits inside its superset.
 *
 * Returns null when the exercise stands alone: "no group" is a real answer
 * rather than an error, and the callers draw an ordinary bubble for it.
 */
export function getSupersetInfo(
  exercises: readonly SupersetExercise[],
  currentIndex: number,
): SupersetInfo | null {
  const current = exercises[currentIndex];
  if (!current) return null;

  const groupId = current.groupId;
  if (!groupId) return null;

  const members = indicesOfGroup(exercises, groupId);
  const position = members.indexOf(currentIndex);
  // An index that is not in its own group cannot happen, but a list that was
  // edited between the two reads could say so. Treating it as "not in a group"
  // is the answer that keeps the caller honest.
  if (position === -1) return null;

  const tone = toneFor(groupId);

  return {
    groupId,
    label: labelForGroup(exercises, groupId),
    position: position + 1,
    total: members.length,
    color: tone.base,
    tone,
    isFirst: position === 0,
    isLast: position === members.length - 1,
  };
}

/**
 * The next exercise of the same group, or -1 when there is none.
 *
 * The group is a rotation: after the last exercise of a group comes the first
 * one again, which is what makes a superset alternate A, B, A, B. A group with
 * a single member has no next, and neither does an exercise that stands alone.
 *
 * -1 rather than null so the caller can use it as an array index directly.
 */
export function getNextSupersetTargetIndex(
  exercises: readonly SupersetExercise[],
  currentIndex: number,
): number {
  const current = exercises[currentIndex];
  if (!current) return -1;

  const groupId = current.groupId;
  if (!groupId) return -1;

  const members = indicesOfGroup(exercises, groupId);
  if (members.length < 2) return -1;

  const position = members.indexOf(currentIndex);
  if (position === -1) return -1;

  // The rotation: the member after this one, wrapping to the first.
  const next = members[(position + 1) % members.length];
  return next === currentIndex ? -1 : next;
}

/**
 * The indices of every exercise that shares a group id.
 *
 * The order is the order of the list, which is the order the athlete performs
 * them in.
 */
function indicesOfGroup(
  exercises: readonly SupersetExercise[],
  groupId: string,
): number[] {
  const indices: number[] = [];
  exercises.forEach((exercise, index) => {
    if (exercise.groupId === groupId) indices.push(index);
  });
  return indices;
}

/**
 * The letter a group is labelled with, by order of appearance.
 *
 * Every member of a group resolves the same letter, because the letter is
 * read off the whole list rather than off the member's own position.
 */
function labelForGroup(
  exercises: readonly SupersetExercise[],
  groupId: string,
): string {
  const seen: string[] = [];
  for (const exercise of exercises) {
    const id = exercise.groupId;
    if (!id || seen.includes(id)) continue;
    seen.push(id);
    if (id === groupId) break;
  }
  const position = seen.indexOf(groupId);
  return letterFor(position === -1 ? 0 : position);
}

/**
 * The letter for a group index: A, B, ... Z, AA, AB...
 *
 * Spreadsheet naming rather than a modulo, so the twenty-seventh group is
 * "AA" instead of "A" again.
 */
function letterFor(index: number): string {
  let remaining = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (remaining % 26)) + letter;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return letter;
}

/** The colour a group is painted in: a hash of its id, never its position. */
function toneFor(groupId: string): SupersetTone {
  return SUPERSET.palette[hash(groupId) % SUPERSET.palette.length];
}

/**
 * FNV-1a.
 *
 * A hash rather than `Math.random`, because the colour has to be the same
 * every time the same group is rendered: on the next render, on the next
 * session, on another device.
 */
function hash(value: string): number {
  let acc = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    acc ^= value.charCodeAt(index);
    // 16777619, the FNV prime, times the accumulator, in 32-bit arithmetic.
    acc = Math.imul(acc, 0x01000193) >>> 0;
  }
  return acc >>> 0;
}
