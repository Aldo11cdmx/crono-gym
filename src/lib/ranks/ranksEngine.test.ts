/**
 * ranksEngine.test.ts — the four properties the rank engine is judged on.
 *
 * The other five suites in this folder each defend one module. This one is the
 * contract the whole ladder is sold on, end to end, and it exists because those
 * properties are *emergent*: none of them is visible in any single module.
 *
 *   1. Epley 1RM, within the rep window the formula is valid for.
 *   2. Progression: 70% strength + 30% volume, and the ladder it produces.
 *   3. Hysteresis and decay: a bad day does not cost a rank, a layoff does cost
 *      points.
 *   4. Tokens and glyphs: every rank carries colour, border, glyph and label that
 *      survive being read by someone who cannot separate hues.
 *
 * The scorer is exercised through `calculateMuscleScore` with the real standard
 * ratio tables rather than a stubbed ladder, because the interesting failures here
 * are mismatches between what the scorer produced and what the ladder claims -- a
 * muscle at 47 points labelled Silver, or a rank that changes when a session did
 * not.
 */

import { describe, expect, it } from "vitest";
import {
  calculateMuscleScore,
  confidenceFor,
  decayFactorFor,
  type ExerciseRow,
  type SetRow,
} from "./muscleScore";
import {
  getNextRankProgress,
  isPromotion,
  rankDelta,
  scoreToRank,
  scoreToRankWithHysteresis,
} from "./scoreToRank";
import {
  ELIGIBILITY,
  FIRST_RANK,
  RANKS,
  SCORE_WEIGHTS,
  VOLUME_RULES,
  standardRatioFor,
  type RankId,
} from "./rankConfig";
import {
  AA_CONTRAST,
  CVD_DISTINGUISHABLE,
  SURFACE_BLACK,
  contrastRatio,
  cvdDeltaE,
  deltaE,
  paletteFor,
  worstCaseCvdDeltaE,
} from "./rankColors";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "row", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
];

/** Chest: `pectorals` is primary, nothing else is even a synergist here. */
const chestWeights = (exercise: ExerciseRow): number | null =>
  exercise.target === "pectorals" ? 1.0 : null;

const context = { bodyweightKg: 80, sex: "male" as const, now: NOW };

/** `sessions` sessions of a press at `weight` x `reps`, one set each. */
function press(weight: number, reps: number, sessions = 3, spacingDays = 7): SetRow[] {
  return Array.from({ length: sessions }, (_, i) => ({
    exerciseId: "press",
    weight,
    reps,
    isWarmup: false,
    performedAt: daysAgo(i * spacingDays),
  }));
}

function score(weight: number, reps: number, sessions = 3): number {
  const result = calculateMuscleScore({
    sets: press(weight, reps, sessions),
    exercises: EXERCISES,
    context,
    weightFor: chestWeights,
  });
  return result.score;
}

// ------------------------------------------------------------------ 1. Epley

describe("Epley estimated 1RM", () => {
  /**
   * The formula itself: `1RM = W x (1 + R/30)`.
   *
   * Asserted against `calculateMuscleScore`'s contribution so the estimate that
   * reaches the database is the one being checked, not a private helper that
   * happens to look right.
   */
  it("is weight x (1 + reps/30), read back off the muscle's contribution", () => {
    const result = calculateMuscleScore({
      sets: press(100, 5, 3),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });

    const contribution = result.contributions.find((c) => c.exerciseId === "press");
    expect(contribution).toBeDefined();
    // 100 x (1 + 5/30) = 116.667
    expect(contribution!.estimatedOneRepMax).toBeCloseTo(116.7, 1);
  });

  it("leaves a single rep untouched and doubles a set of ten", () => {
    const one = calculateMuscleScore({
      sets: press(120, 1, 3), exercises: EXERCISES, context, weightFor: chestWeights,
    }).contributions[0].estimatedOneRepMax;
    const ten = calculateMuscleScore({
      sets: press(120, 10, 3), exercises: EXERCISES, context, weightFor: chestWeights,
    }).contributions[0].estimatedOneRepMax;

    // R=1 -> 120 x 1.033; R=10 -> 120 x 1.333.
    expect(one).toBeCloseTo(124, 0);
    expect(ten).toBeCloseTo(160, 0);
  });

  it("ignores sets past the validated rep window rather than extrapolating", () => {
    // Epley is only meaningful to ~10 reps. Past that the estimate keeps rising,
    // so a set of 30 "reps" would score as the strongest thing the user ever did.
    const valid = calculateMuscleScore({
      sets: press(80, 10, 3), exercises: EXERCISES, context, weightFor: chestWeights,
    });
    const inflated = calculateMuscleScore({
      sets: press(80, 30, 3), exercises: EXERCISES, context, weightFor: chestWeights,
    });

    expect(inflated.contributions.length).toBe(0);
    expect(inflated.classified).toBe(false);
    expect(inflated.unrankedReason).toBe("no_strength_signal");
    expect(valid.classified).toBe(true);
  });

  it("keeps the best estimate ever, so a deload does not erase a personal best", () => {
    // Three sessions on distinct dates: two strong, then a lighter one. The best
    // is a fact about what the user has done, and discarding it the moment they
    // take a deload week is how ranks collapse for the wrong reason.
    const history: SetRow[] = [
      { exerciseId: "press", weight: 100, reps: 5, isWarmup: false, performedAt: daysAgo(21) },
      { exerciseId: "press", weight: 100, reps: 5, isWarmup: false, performedAt: daysAgo(14) },
      { exerciseId: "press", weight: 70, reps: 5, isWarmup: false, performedAt: daysAgo(7) },
    ];
    const result = calculateMuscleScore({
      sets: history, exercises: EXERCISES, context, weightFor: chestWeights,
    });

    expect(result.classified).toBe(true);
    expect(result.contributions[0].estimatedOneRepMax).toBeCloseTo(116.7, 1);
  });

  it("scales the ratio against bodyweight, not raw kilos", () => {
    // The same lift by two people of different mass is a different capability,
    // and comparing raw kilos would call it the same.
    const light = calculateMuscleScore({
      sets: press(100, 5, 3),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: 60 },
      weightFor: chestWeights,
    });
    const heavy = calculateMuscleScore({
      sets: press(100, 5, 3),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: 120 },
      weightFor: chestWeights,
    });

    expect(light.contributions[0].ratio).toBeGreaterThan(heavy.contributions[0].ratio);
    expect(light.score).toBeGreaterThan(heavy.score);
  });
});

// ----------------------------------------------------------- 2. progression

describe("score composition", () => {
  it("is 70% strength and 30% volume", () => {
    expect(SCORE_WEIGHTS.strength).toBe(0.7);
    expect(SCORE_WEIGHTS.volume).toBe(0.3);

    const result = calculateMuscleScore({
      sets: press(100, 5, 3),
      exercises: EXERCISES,
      context,
      weightFor: chestWeights,
    });

    const expected =
      result.strength!.volumePercent * SCORE_WEIGHTS.strength +
      result.volume.volumePercent * SCORE_WEIGHTS.volume;
    expect(result.score).toBeCloseTo(expected, 1);
  });

  it("will not rank a muscle below the session minimum", () => {
    const two = calculateMuscleScore({
      sets: press(100, 5, 2), exercises: EXERCISES, context, weightFor: chestWeights,
    });

    expect(two.classified).toBe(false);
    expect(two.unrankedReason).toBe("insufficient_sessions");
    expect(scoreToRank(two.score).id).toBe("unranked");
  });

  it("cannot score a lifter with no bodyweight", () => {
    // Every score is a ratio against bodyweight, so without one there is no score.
    const result = calculateMuscleScore({
      sets: press(100, 5, 3),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: null },
      weightFor: chestWeights,
    });

    expect(result.classified).toBe(false);
    expect(result.unrankedReason).toBe("unknown_bodyweight");
  });

  it("rises monotonically as the lifter gets stronger", () => {
    const scores = [60, 70, 80, 90, 100, 110].map((w) => score(w, 5, 6));
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i], `weight ${[60, 70, 80, 90, 100, 110][i]}`).toBeGreaterThan(scores[i - 1]);
    }
  });

  it("reaches the top of the ladder only for a genuinely exceptional muscle", () => {
    // Obsidian starts at 95, not 100. If a strong lifter landed there routinely,
    // the top rank would stop meaning anything.
    const strong = score(150, 5, 8);
    expect(strong).toBeGreaterThan(60);
    expect(strong).toBeLessThan(95);
  });
});

describe("the ladder", () => {
  it("has the seven earned ranks, in ascending order", () => {
    const earned = RANKS.filter((r) => r.id !== "unranked");
    expect(earned.map((r) => r.id)).toEqual([
      "bronze", "silver", "gold", "platinum", "diamond", "elite", "obsidian",
    ]);
    for (let i = 1; i < earned.length; i += 1) {
      expect(earned[i].minScore, `${earned[i].id} sube`).toBeGreaterThan(earned[i - 1].minScore);
    }
  });

  it("resolves a score to the highest threshold it clears", () => {
    // Boundaries are inclusive: a score of exactly 46 is Gold, not Silver.
    expect(scoreToRank(46).id).toBe("gold");
    expect(scoreToRank(45.9).id).toBe("silver");
    expect(scoreToRank(0).id).toBe("unranked");
    expect(scoreToRank(100).id).toBe("obsidian");
  });

  it("refuses a nonsensical score rather than ranking it", () => {
    expect(scoreToRank(-5).id).toBe("unranked");
    expect(scoreToRank(Number.NaN).id).toBe("unranked");
    expect(scoreToRank(Number.POSITIVE_INFINITY).id).toBe("unranked");
  });

  it("starts an empty bar at the floor of the current rank", () => {
    const atFloor = getNextRankProgress(FIRST_RANK.minScore);
    expect(atFloor.current.id).toBe("bronze");
    expect(atFloor.percent).toBe(0);
    expect(atFloor.next!.id).toBe("silver");
    expect(atFloor.pointsToNext).toBe(RANKS[2].minScore - FIRST_RANK.minScore);
    expect(atFloor.nearlyThere).toBe(false);
  });

  it("flags a muscle that one session away from promoting", () => {
    const justBelow = getNextRankProgress(27.9);
    expect(justBelow.current.id).toBe("bronze");
    expect(justBelow.percent).toBeGreaterThan(0.9);
    expect(justBelow.nearlyThere).toBe(true);
  });

  it("makes the bar mean the same thing in a wide band and a narrow one", () => {
    // Silver->Gold is 18 points and Gold->Platinum is 18 as well, so the real
    // property to check is that `percent` is a fraction of the band rather than a
    // count of points: half way through each band is half a bar, whatever the
    // width.
    const silver = RANKS.find((r) => r.id === "silver")!;
    const gold = RANKS.find((r) => r.id === "gold")!;
    const platinum = RANKS.find((r) => r.id === "platinum")!;

    const silverHalf = getNextRankProgress(silver.minScore + (gold.minScore - silver.minScore) / 2);
    const goldHalf = getNextRankProgress(gold.minScore + (platinum.minScore - gold.minScore) / 2);

    expect(silverHalf.percent).toBeCloseTo(0.5, 2);
    expect(goldHalf.percent).toBeCloseTo(0.5, 2);
  });

  it("reports no next rank at the top of the ladder", () => {
    const top = getNextRankProgress(100);
    expect(top.current.id).toBe("obsidian");
    expect(top.next).toBeNull();
    expect(top.pointsToNext).toBe(0);
    expect(top.percent).toBe(1);
  });

  it("never renders a negative bar after a hysteresis-held rank", () => {
    // Hysteresis can leave a muscle sitting on a rank its score no longer
    // qualifies for; the progress bar must not go negative when it does.
    const progress = getNextRankProgress(RANKS[2].minScore - 1);
    expect(progress.percent).toBeGreaterThanOrEqual(0);
  });
});

// ------------------------------------------------- 3. hysteresis and decay

describe("hysteresis", () => {
  it("promotes at the threshold, with no buffer", () => {
    expect(scoreToRankWithHysteresis(28, "bronze").id).toBe("silver");
  });

  it("keeps the rank through a dip that does not clear the buffer", () => {
    // Silver starts at 28 and the buffer is 3, so 25.1 still holds Silver. A score
    // of 26 is a bad session, not a decline, and the badge stays.
    expect(scoreToRankWithHysteresis(26, "silver").id).toBe("silver");
    expect(scoreToRankWithHysteresis(25.1, "silver").id).toBe("silver");
  });

  it("demotes once the score falls the full buffer below the floor", () => {
    // Exactly on the buffer counts as demoted: "fell N points below" includes N.
    expect(scoreToRankWithHysteresis(25, "silver").id).toBe("bronze");
    expect(scoreToRankWithHysteresis(24.9, "silver").id).toBe("bronze");
  });

  it("does not apply the buffer to unranked, which means 'no data'", () => {
    // Holding a stale rank while the data has gone is worse than admitting the
    // gap, so this case is exempt.
    expect(scoreToRankWithHysteresis(5, "gold").id).toBe("unranked");
    expect(scoreToRankWithHysteresis(46, "unranked").id).toBe("gold");
  });

  it("reports a promotion as a positive delta and a demotion as negative", () => {
    // Indices include `unranked`, so Gold -> Silver is one step, not two.
    expect(rankDelta("bronze", "silver")).toBe(1);
    expect(rankDelta("gold", "silver")).toBe(-1);
    expect(rankDelta("bronze", "obsidian")).toBe(6);
    expect(rankDelta(null, "gold")).toBe(0);
    expect(rankDelta("gold", "gold")).toBe(0);
    expect(isPromotion("bronze", "silver")).toBe(true);
    expect(isPromotion("silver", "bronze")).toBe(false);
    expect(isPromotion("gold", "gold")).toBe(false);
  });

  it("survives a bad session without losing the rank", () => {
    // The end-to-end version of the two cases above, through the real scorer.
    const good = calculateMuscleScore({
      sets: press(100, 5, 6), exercises: EXERCISES, context, weightFor: chestWeights,
    });
    const bad = calculateMuscleScore({
      sets: press(88, 5, 6), exercises: EXERCISES, context, weightFor: chestWeights,
    });

    const held = scoreToRankWithHysteresis(bad.score, scoreToRank(good.score).id);
    expect(held.id).toBe(scoreToRank(good.score).id);
  });
});

describe("inactivity decay", () => {
  it("holds the volume component flat through the grace period", () => {
    expect(decayFactorFor(0)).toBe(1);
    expect(decayFactorFor(VOLUME_RULES.decayAfterDays)).toBe(1);
  });

  it("decays gradually rather than as a cliff", () => {
    const atThreshold = decayFactorFor(VOLUME_RULES.decayAfterDays);
    const partway = decayFactorFor(VOLUME_RULES.decayAfterDays + VOLUME_RULES.decayRampDays / 2);
    const fully = decayFactorFor(
      VOLUME_RULES.decayAfterDays + VOLUME_RULES.decayRampDays,
    );

    expect(partway).toBeLessThan(atThreshold);
    expect(partway).toBeGreaterThan(fully);
    expect(fully).toBeCloseTo(VOLUME_RULES.decayFloor, 5);
  });

  it("never falls below the floor however long the layoff", () => {
    expect(decayFactorFor(365)).toBe(VOLUME_RULES.decayFloor);
    expect(decayFactorFor(5000)).toBe(VOLUME_RULES.decayFloor);
  });

  it("returns zero for a muscle that was never trained", () => {
    expect(decayFactorFor(null)).toBe(0);
  });

  it("takes points off the score over a layoff, without touching strength", () => {
    // The same six sessions, but the most recent one is eight months old rather
    // than today. Decay is about *recency*, so spacing alone is not enough to
    // trigger it.
    const fresh = calculateMuscleScore({
      sets: press(100, 5, 6), exercises: EXERCISES, context, weightFor: chestWeights,
    });
    const lapsed: SetRow[] = Array.from({ length: 6 }, (_, i) => ({
      exerciseId: "press",
      weight: 100,
      reps: 5,
      isWarmup: false,
      performedAt: daysAgo(240 + i * 7),
    }));
    const stale = calculateMuscleScore({
      sets: lapsed, exercises: EXERCISES, context, weightFor: chestWeights,
    });

    expect(stale.score).toBeLessThan(fresh.score);
    // Muscle memory is real, so the best-ever 1RM is not what decays.
    expect(stale.contributions[0].estimatedOneRepMax).toBe(
      fresh.contributions[0].estimatedOneRepMax,
    );
    expect(stale.volume.decayFactor).toBeLessThan(1);
    expect(stale.volume.decayFactor).toBeGreaterThanOrEqual(VOLUME_RULES.decayFloor);
    expect(fresh.volume.decayFactor).toBe(1);
  });

  it("reports confidence for stale data even with many sessions behind it", () => {
    // Fifty sessions from last year is not the same understanding as eight from
    // this month, so recency caps confidence however much data produced it.
    expect(confidenceFor(50, 0, "male")).toBe("high");
    expect(confidenceFor(50, 200, "male")).toBe("medium");
    expect(confidenceFor(2, 0, "male")).toBe("low");
    expect(confidenceFor(50, 0, "other")).toBe("medium");
  });
});

// ------------------------------------------------------- 4. tokens and glyphs

describe("rank tokens", () => {
  const earned = RANKS.filter((r) => r.id !== "unranked");

  it("gives every earned rank the specified colour and glyph", () => {
    // The palette is a product decision, so it is pinned exactly rather than
    // derived. A retune is a one-line diff here and in rankConfig, not a hunt.
    const expected: Record<RankId, [string, string]> = {
      unranked: ["#3f3f46", "—"],
      bronze: ["#b07a4f", "●"],
      silver: ["#9ca3af", "◆"],
      gold: ["#f2b84b", "★"],
      platinum: ["#9fd3d6", "⬟"],
      diamond: ["#7db7ff", "⬢"],
      elite: ["#8B5CF6", "✦"],
      obsidian: ["#0F0A1E", "✷"],
    };

    for (const rank of RANKS) {
      const [color, glyph] = expected[rank.id];
      expect(rank.color, rank.id).toBe(color);
      expect(rank.glyph, rank.id).toBe(glyph);
    }
    expect(earned).toHaveLength(7);
  });

  it("gives Obsidiana its own border, since its fill is nearly black", () => {
    const obsidian = RANKS.find((r) => r.id === "obsidian")!;
    expect(obsidian.color).toBe("#0F0A1E");
    expect(obsidian.borderColor).toBe("#DDD6FE");
    // The fill is invisible on a black panel; the stroke is what draws it.
    expect(contrastRatio(obsidian.color, SURFACE_BLACK)).toBeLessThan(2);
    expect(contrastRatio(obsidian.borderColor, SURFACE_BLACK)).toBeGreaterThan(10);
  });

  it("clears the text-contrast floor on every fill", () => {
    for (const rank of RANKS) {
      if (rank.id === "unranked" || rank.id === "obsidian") continue;
      expect(contrastRatio(rank.color, SURFACE_BLACK), `${rank.id}`).toBeGreaterThanOrEqual(
        AA_CONTRAST,
      );
    }
  });

  it("keeps the label readable on the fill it is drawn on", () => {
    for (const rank of RANKS) {
      const palette = paletteFor(rank);
      expect(
        contrastRatio(palette.label, palette.fill),
        `${rank.id}: etiqueta sobre ${rank.color}`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });
});

describe("rank glyphs are legible without colour", () => {
  it("gives every rank a glyph no other rank uses", () => {
    // The channel that has to work in monochrome, in print, and for a viewer who
    // sees no hue at all. Distinctness is the whole requirement.
    expect(new Set(RANKS.map((r) => r.glyph)).size).toBe(RANKS.length);
  });

  it("uses a glyph that renders, rather than a blank or a tofu box", () => {
    for (const rank of RANKS) {
      expect(rank.glyph, rank.id).toBeTruthy();
      expect(rank.glyph.trim(), rank.id).not.toBe("");
      // U+FFFD is the replacement character: a font that lacked the glyph.
      expect(rank.glyph, rank.id).not.toContain("\uFFFD");
    }
  });

  it("keeps every pair of fills distinguishable to a dichromat", () => {
    // The fill is a redundant channel, so this is a floor rather than the only
    // guarantee -- but a palette that collapses under any of the three
    // dichromacies is not colour-blind safe, it is colour-blind safe on average.
    for (const a of RANKS) {
      for (const b of RANKS) {
        if (a.id === b.id) continue;
        expect(
          worstCaseCvdDeltaE(a.color, b.color),
          `${a.id} vs ${b.id}`,
        ).toBeGreaterThanOrEqual(CVD_DISTINGUISHABLE);
      }
    }
  });

  it("keeps adjacent fills distinguishable under each dichromacy separately", () => {
    // Asserting only the worst case would let a single failing dichromacy hide
    // behind two that pass.
    const ordered = [...RANKS].sort((x, y) => x.minScore - y.minScore);
    for (const kind of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      for (let i = 1; i < ordered.length; i += 1) {
        expect(
          cvdDeltaE(ordered[i - 1].color, ordered[i].color, kind),
          `${kind}: ${ordered[i - 1].id} vs ${ordered[i].id}`,
        ).toBeGreaterThanOrEqual(CVD_DISTINGUISHABLE);
      }
    }
  });

  it("reports a colour as zero distance from itself", () => {
    expect(deltaE("#f2b84b", "#f2b84b")).toBe(0);
  });

  it("gives Obsidiana a separate border because its fill cannot separate", () => {
    // Near-black on near-black is ΔE 0 by construction, so the rank is carried
    // by its stroke. Asserting that the exception is deliberate rather than
    // accidental is the point of this test.
    const obsidian = RANKS.find((r) => r.id === "obsidian")!;
    const elite = RANKS.find((r) => r.id === "elite")!;

    expect(deltaE(obsidian.color, elite.color)).toBeGreaterThanOrEqual(CVD_DISTINGUISHABLE);
    expect(contrastRatio(obsidian.borderColor, SURFACE_BLACK)).toBeGreaterThan(
      contrastRatio(elite.borderColor, SURFACE_BLACK),
    );
  });
});

describe("standard ratios", () => {
  it("rate the same lift differently by sex, because published standards differ", () => {
    const male = standardRatioFor("bench", "male");
    const female = standardRatioFor("bench", "female");

    expect(male).toBeGreaterThan(female);
    // A single unisex table would rate most women who lift as unranked.
    expect(female).toBeGreaterThan(0.5);
  });

  it("fall back to the midpoint for undisclosed sex, not to the male table", () => {
    const other = standardRatioFor("bench", "other");
    expect(other).toBeCloseTo((1.25 + 0.8) / 2, 5);
    // Picking male would systematically under-rate a non-binary lifter.
    expect(other).toBeLessThan(standardRatioFor("bench", "male"));
    expect(other).toBeGreaterThan(standardRatioFor("bench", "female"));
  });
});

describe("eligibility", () => {
  it("requires three sessions, which is the documented minimum", () => {
    expect(ELIGIBILITY.minSessions).toBe(3);
  });

  it("needs a real bodyweight, and treats zero as missing", () => {
    const zero = calculateMuscleScore({
      sets: press(100, 5, 3),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: 0 },
      weightFor: chestWeights,
    });

    expect(zero.unrankedReason).toBe("unknown_bodyweight");
  });
});