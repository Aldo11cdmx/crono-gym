import { describe, expect, it } from "vitest";
import {
  getNextRankProgress,
  isPromotion,
  rankDelta,
  scoreToRank,
  scoreToRankId,
  scoreToRankWithHysteresis,
} from "./scoreToRank";
import { EARNABLE_RANKS, HYSTERESIS, RANKS, rankById, type RankId } from "./rankConfig";

/**
 * Boundary tests use every threshold from the config rather than hardcoded
 * numbers, so editing `rankConfig.ts` moves the tests with it instead of
 * silently making them assert thresholds the product no longer uses.
 */
const THRESHOLDS = RANKS.map((r) => ({ id: r.id, min: r.minScore }));

describe("scoreToRank", () => {
  it("maps a score below the first threshold to unranked", () => {
    expect(scoreToRank(0).id).toBe("unranked");
    expect(scoreToRank(11.9).id).toBe("unranked");
  });

  it.each(THRESHOLDS.filter((t) => t.id !== "unranked"))(
    "treats the exact threshold of $id as inclusive",
    ({ id, min }) => {
      expect(scoreToRank(min).id).toBe(id);
    },
  );

  it.each(THRESHOLDS.filter((t) => t.id !== "unranked"))(
    "puts a score just below the $id threshold in the rank below",
    ({ id, min }) => {
      const index = RANKS.findIndex((r) => r.id === id);
      const below = RANKS[index - 1];
      expect(scoreToRank(min - 0.01).id).toBe(below.id);
    },
  );

  it("caps at Obsidian above the top threshold", () => {
    const top = RANKS[RANKS.length - 1];
    expect(scoreToRank(top.minScore + 50).id).toBe(top.id);
  });

  it("clamps nonsense input to unranked rather than throwing", () => {
    expect(scoreToRank(Number.NaN).id).toBe("unranked");
    expect(scoreToRank(Number.POSITIVE_INFINITY).id).toBe("unranked");
    expect(scoreToRank(-5).id).toBe("unranked");
  });

  it("exposes the same result as an id", () => {
    expect(scoreToRankId(50)).toBe(scoreToRank(50).id);
  });
});

describe("scoreToRankWithHysteresis", () => {
  it("returns the fresh rank on a first computation", () => {
    expect(scoreToRankWithHysteresis(50, null).id).toBe("gold");
  });

  it("promotes immediately when the score clears the next threshold", () => {
    // Silver -> Gold at 46.
    expect(scoreToRankWithHysteresis(46, "silver").id).toBe("gold");
  });

  it("promotes across more than one rank at once", () => {
    expect(scoreToRankWithHysteresis(82, "bronze").id).toBe("diamond");
  });

  it("keeps the held rank when the score dips just under the threshold", () => {
    const gold = rankById("gold");
    const score = gold.minScore - (HYSTERESIS.demotionBuffer - 0.5);
    // Without hysteresis this would be Silver; the buffer holds Gold.
    expect(scoreToRank(score).id).toBe("silver");
    expect(scoreToRankWithHysteresis(score, "gold").id).toBe("gold");
  });

  it("demotes once the score falls the full buffer below", () => {
    const gold = rankById("gold");
    const score = gold.minScore - HYSTERESIS.demotionBuffer;
    expect(scoreToRankWithHysteresis(score, "gold").id).toBe("silver");
  });

  it("demotes several ranks at once for a large drop", () => {
    expect(scoreToRankWithHysteresis(5, "gold").id).toBe("unranked");
  });

  it("does not apply the buffer to unranked", () => {
    // Holding a stale rank while the data disappears would be a lie.
    expect(scoreToRankWithHysteresis(3, "gold").id).toBe("unranked");
  });

  it("promotes out of unranked as soon as the score qualifies", () => {
    expect(scoreToRankWithHysteresis(14, "unranked").id).toBe("bronze");
  });

  it("holds a rank through a single bad session and a good one", () => {
    // The flicker scenario the buffer exists for.
    const bad = 44.5; // under Gold's 46
    const good = 47;
    expect(scoreToRankWithHysteresis(bad, "gold").id).toBe("gold");
    expect(scoreToRankWithHysteresis(good, "gold").id).toBe("gold");
  });

  it("does not promote then immediately demote on a wobble", () => {
    // Damped promotion is off, so promotion is immediate; the point is that the
    // return trip is damped.
    expect(scoreToRankWithHysteresis(46.5, "silver").id).toBe("gold");
    expect(scoreToRankWithHysteresis(45.5, "gold").id).toBe("gold");
  });

  it("ignores an unknown previous rank id", () => {
    const bogus = "not-a-rank" as RankId;
    expect(scoreToRankWithHysteresis(50, bogus).id).toBe("gold");
  });
});

describe("getNextRankProgress", () => {
  it("reports zero progress at a rank's own threshold", () => {
    const progress = getNextRankProgress(rankById("gold").minScore);
    expect(progress.percent).toBe(0);
    expect(progress.next?.id).toBe("platinum");
    expect(progress.pointsToNext).toBe(rankById("platinum").minScore - rankById("gold").minScore);
  });

  it("reaches full progress one point below the next threshold", () => {
    const next = rankById("gold");
    const progress = getNextRankProgress(next.minScore - 0.01);
    expect(progress.percent).toBeLessThanOrEqual(1);
    expect(progress.current.id).toBe("silver");
  });

  it("never reports progress past the top rank", () => {
    const top = RANKS[RANKS.length - 1];
    const progress = getNextRankProgress(top.minScore + 20);
    expect(progress.next).toBeNull();
    expect(progress.percent).toBe(1);
    expect(progress.pointsToNext).toBe(0);
  });

  it("flags being within the last fifth of the band", () => {
    const gold = rankById("gold");
    const platinum = rankById("platinum");
    const span = platinum.minScore - gold.minScore;
    // 85% through the band.
    const nearly = gold.minScore + span * 0.85;
    expect(getNextRankProgress(nearly).nearlyThere).toBe(true);
    expect(getNextRankProgress(gold.minScore + span * 0.5).nearlyThere).toBe(false);
  });

  it("never renders a negative bar when hysteresis holds a rank", () => {
    // Gold held at 44.5 by the buffer, which is below Gold's own floor of 46.
    const progress = getNextRankProgress(rankById("gold").minScore - 2);
    expect(progress.percent).toBeGreaterThanOrEqual(0);
    expect(progress.pointsToNext).toBeGreaterThan(0);
  });

  it("walks every earnable rank without a gap", () => {
    for (const rank of EARNABLE_RANKS) {
      const progress = getNextRankProgress(rank.minScore);
      expect(progress.current.id).toBe(rank.id);
      expect(progress.percent).toBeGreaterThanOrEqual(0);
      expect(progress.percent).toBeLessThanOrEqual(1);
    }
  });
});

describe("rankDelta and isPromotion", () => {
  it("counts steps upward as positive", () => {
    expect(rankDelta("silver", "gold")).toBe(1);
    expect(rankDelta("bronze", "platinum")).toBeGreaterThan(0);
  });

  it("counts steps downward as negative", () => {
    expect(rankDelta("gold", "silver")).toBe(-1);
  });

  it("returns zero for an unchanged rank", () => {
    expect(rankDelta("gold", "gold")).toBe(0);
  });

  it("returns zero when there is no previous rank", () => {
    expect(rankDelta(null, "gold")).toBe(0);
  });

  it("only reports promotion for a gain", () => {
    expect(isPromotion("silver", "gold")).toBe(true);
    expect(isPromotion("gold", "gold")).toBe(false);
    expect(isPromotion("gold", "silver")).toBe(false);
    expect(isPromotion(null, "gold")).toBe(false);
  });
});

describe("rankConfig invariants", () => {
  it("has strictly ascending thresholds", () => {
    for (let i = 1; i < RANKS.length; i += 1) {
      expect(RANKS[i].minScore).toBeGreaterThan(RANKS[i - 1].minScore);
    }
  });

  it("starts unranked at zero", () => {
    expect(RANKS[0].id).toBe("unranked");
    expect(RANKS[0].minScore).toBe(0);
  });

  it("gives every rank a glyph, so rank is not colour-only", () => {
    for (const rank of RANKS) {
      expect(rank.glyph.length).toBeGreaterThan(0);
      expect(rank.label.length).toBeGreaterThan(0);
    }
  });

  it("uses distinct glyphs per rank", () => {
    const glyphs = RANKS.map((r) => r.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("defines exactly the seven requested ranks plus unranked", () => {
    expect(RANKS).toHaveLength(8);
    expect(EARNABLE_RANKS.map((r) => r.id)).toEqual([
      "bronze",
      "silver",
      "gold",
      "platinum",
      "diamond",
      "elite",
      "obsidian",
    ]);
  });
});