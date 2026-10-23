/**
 * @vitest-environment node
 *
 * recordBreak.test.ts — the line between a record and everything else.
 *
 * Every case here is a way this could say "record" when it should not, which is
 * the only direction that costs trust. The false negative (missing a real record)
 * is a missed celebration; the false positive is an athlete who stops believing
 * the badge, and then stops believing the Records tab it agrees with.
 *
 * Epley is `weight × (1 + reps/30)`, estimable only up to 10 reps. The numbers
 * below are chosen so the estimates are far enough apart that no floating-point
 * rounding can flip the comparison.
 */

import { describe, expect, it } from "vitest";
import { isRecordBreak } from "./recordBreak";

describe("isRecordBreak", () => {
  it("is not a record when there is no best to beat", () => {
    // A first set is a first. "Nuevo récord" on an athlete's first ever working
    // set describes a competition that has not happened.
    expect(isRecordBreak(100, 8, null)).toBe(false);
  });

  it("is a record when the estimated 1RM is higher", () => {
    // 100×8 = 126.7 against a best of 100×5 = 116.7.
    expect(isRecordBreak(100, 8, { weightKg: 100, reps: 5 })).toBe(true);
  });

  it("is a record on a heavier load at fewer reps", () => {
    // 120×3 = 132 against a best of 100×10 = 133.3 -- a heavier bar, but a
    // lower estimate, so not a record by the measure the Records tab uses.
    expect(isRecordBreak(120, 3, { weightKg: 100, reps: 10 })).toBe(false);
  });

  it("credits one more rep at the same weight, which weight alone would miss", () => {
    // 100×6 = 120 against 100×5 = 116.7. The weight did not move; the athlete
    // still got stronger, and this is the case a weight-only detector reports as
    // "held the record" on every session.
    expect(isRecordBreak(100, 6, { weightKg: 100, reps: 5 })).toBe(true);
  });

  it("is not a record when the estimate only matches", () => {
    // Equal is holding, not breaking. Greater-or-equal would fire the badge on
    // every repeat of the record weight.
    expect(isRecordBreak(100, 5, { weightKg: 100, reps: 5 })).toBe(false);
  });

  it("is not a record when the estimate is lower", () => {
    expect(isRecordBreak(90, 5, { weightKg: 100, reps: 5 })).toBe(false);
  });

  it("is not a record for a set the estimator refuses to rank", () => {
    // 100×11 is past the estimable range. Comparing it on raw weight would be a
    // second rule, and would crown records on sets Epley declines to score.
    expect(isRecordBreak(100, 11, { weightKg: 100, reps: 5 })).toBe(false);
  });

  it("is not a record for a set with no reps", () => {
    // No reps means no 1RM, and a set with no 1RM cannot be shown to beat one.
    expect(isRecordBreak(120, 0, { weightKg: 100, reps: 5 })).toBe(false);
  });

  it("falls back to raw weight when the best itself is unranked", () => {
    // The best was logged without a rep count, so it has no estimate. A strictly
    // heavier load is a record whatever the reps, because weight is a lower
    // bound on the 1RM.
    expect(isRecordBreak(105, 5, { weightKg: 100, reps: null })).toBe(true);
  });

  it("is not a record at the same weight when the best is unranked", () => {
    // Equal weight proves nothing when the best may have had reps this set does
    // not, so the conservative reading is "not shown to be a record".
    expect(isRecordBreak(100, 5, { weightKg: 100, reps: null })).toBe(false);
  });

  it("is not a record on a lighter load when the best is unranked", () => {
    expect(isRecordBreak(95, 8, { weightKg: 100, reps: null })).toBe(false);
  });
});