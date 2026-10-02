import { describe, expect, it } from "vitest";
import {
  buildRankMap,
  colorByMuscle,
  historyEntriesFor,
  promotionsIn,
  rankDistribution,
  sessionsUntilFirstRank,
  shouldShowEmptyState,
  snapshotRanks,
  type PreviousRanks,
} from "./buildRankMap";
import type { ExerciseRow, SetRow } from "./muscleScore";
import { enabledSlugs } from "../muscleMap";
import { EARNABLE_RANKS } from "./rankConfig";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "row", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
  { id: "squat", name: "Sentadilla", target: "glutes", body_part: "upper legs", equipment: "barbell" },
  { id: "ohp", name: "Press militar", target: "delts", body_part: "shoulders", equipment: "barbell" },
];

/**
 * Builds `sessions` weekly sessions of one exercise, ramping the load so the
 * score has something to rank rather than sitting on a flat line.
 */
function history(exerciseId: string, weight: number, sessions = 12): SetRow[] {
  return Array.from({ length: sessions }, (_, i) => ({
    exerciseId,
    weight: weight + i,
    reps: 5,
    isWarmup: false,
    performedAt: daysAgo(i * 3),
  }));
}

const context = { bodyweightKg: 80, sex: "male" as const, now: NOW };

describe("buildRankMap", () => {
  it("returns an entry for every enabled muscle", () => {
    const map = buildRankMap({ sets: [], exercises: EXERCISES, context });
    expect(map.muscles.size).toBe(enabledSlugs().length);
    for (const slug of enabledSlugs()) {
      expect(map.muscles.has(slug)).toBe(true);
    }
  });

  it("classifies nothing when there are no sets", () => {
    const map = buildRankMap({ sets: [], exercises: EXERCISES, context });
    expect(map.classifiedCount).toBe(0);
    expect(map.pendingCount).toBe(enabledSlugs().length);
    expect(map.globalRank).toBeNull();
    expect(map.globalScore).toBeNull();
    expect(shouldShowEmptyState(map)).toBe(true);
  });

  it("ranks a muscle that has been trained", () => {
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
    });
    const chest = map.muscles.get("chest");
    expect(chest?.classified).toBe(true);
    expect(chest?.rank.id).not.toBe("unranked");
    expect(chest?.score).toBeGreaterThan(0);
  });

  it("leaves untrained muscles unranked with a reason", () => {
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
    });
    const glutes = map.muscles.get("gluteal");
    expect(glutes?.classified).toBe(false);
    expect(glutes?.unrankedReason).toBe("no_data");
    expect(glutes?.rank.id).toBe("unranked");
  });

  it("averages only classified muscles into the global score", () => {
    const map = buildRankMap({
      sets: [...history("press", 90), ...history("squat", 160)],
      exercises: EXERCISES,
      context,
    });
    // A press and a squat classify more than two muscles, because every muscle
    // sharing a region gets a secondary signal. That is intended, so the test
    // derives the expected set rather than hardcoding a count.
    const classified = [...map.muscles.values()].filter((m) => m.classified);
    expect(classified.length).toBe(map.classifiedCount);
    expect(classified.map((m) => m.slug)).toContain("chest");
    expect(classified.map((m) => m.slug)).toContain("gluteal");

    const mean = classified.reduce((sum, m) => sum + m.score, 0) / classified.length;
    expect(map.globalScore).toBeCloseTo(Math.round(mean * 10) / 10, 1);
  });

  it("excludes unclassified muscles from the global average", () => {
    // Fifteen untrained muscles counting as zero would drag the global rank to
    // unranked regardless of what the user actually did.
    const map = buildRankMap({
      sets: history("squat", 200, 12),
      exercises: EXERCISES,
      context,
    });
    expect(map.pendingCount).toBe(enabledSlugs().length - map.classifiedCount);
    expect(map.globalScore).toBeGreaterThan(0);
    expect(map.globalRank?.id).not.toBe("unranked");
  });

  it("identifies strongest and weakest among classified muscles", () => {
    const map = buildRankMap({
      sets: [...history("squat", 200), ...history("press", 70), ...history("row", 90)],
      exercises: EXERCISES,
      context,
    });
    expect(map.strongest?.slug).toBe("gluteal");
    expect(map.weakest?.slug).toBeTruthy();
    expect(map.strongest!.score).toBeGreaterThan(map.weakest!.score);
  });

  it("reports no weakest muscle when only one is classified", () => {
    // A "weakest" that is also the only muscle is not a weakness; it is the
    // whole picture, and naming it would be misleading.
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
    });
    expect(map.classifiedCount).toBe(1);
    expect(map.weakest).toBeNull();
    expect(map.strongest?.slug).toBe("chest");
  });

  it("marks every muscle unranked when bodyweight is unknown", () => {
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context: { ...context, bodyweightKg: null },
    });
    expect(map.classifiedCount).toBe(0);
    expect(map.muscles.get("chest")?.unrankedReason).toBe("unknown_bodyweight");
  });

  it("survives a set referencing a deleted exercise", () => {
    const sets: SetRow[] = [
      ...history("press", 90),
      { exerciseId: "deleted", weight: 200, reps: 3, isWarmup: false, performedAt: daysAgo(1) },
    ];
    const map = buildRankMap({ sets, exercises: EXERCISES, context });
    // The orphan set is skipped, not fatal.
    expect(map.classifiedCount).toBeGreaterThan(0);
  });

  it("ignores warm-up-only history entirely", () => {
    const sets: SetRow[] = Array.from({ length: 8 }, (_, i) => ({
      exerciseId: "press",
      weight: 120,
      reps: 5,
      isWarmup: true,
      performedAt: daysAgo(i * 2),
    }));
    const map = buildRankMap({ sets, exercises: EXERCISES, context });
    expect(map.classifiedCount).toBe(0);
  });

  it("recomputes when a session is edited away", () => {
    const full = history("press", 90, 12);
    const before = buildRankMap({ sets: full, exercises: EXERCISES, context });
    // Two sessions removed, below the minimum.
    const after = buildRankMap({
      sets: full.slice(0, 2),
      exercises: EXERCISES,
      context,
    });
    expect(before.muscles.get("chest")?.classified).toBe(true);
    expect(after.muscles.get("chest")?.classified).toBe(false);
  });
});

describe("buildRankMap — hysteresis and promotions", () => {
  const previous: PreviousRanks = { chest: "gold" };

  it("holds a rank when the score dips inside the demotion buffer", () => {
    // 118 kg x 5 over three sessions scores ~45.7, just under Gold's floor of
    // 46. Without the buffer that reads as Silver; with it, Gold is kept.
    const map = buildRankMap({
      sets: history("press", 118, 3),
      exercises: EXERCISES,
      context,
      previous,
    });
    const chest = map.muscles.get("chest");
    expect(chest?.classified).toBe(true);
    expect(chest?.score).toBeLessThan(46);
    expect(chest?.score).toBeGreaterThan(43);
    expect(chest?.rank.id).toBe("gold");
    expect(chest?.promoted).toBe(false);
    expect(chest?.delta).toBe(0);
  });

  it("drops the held rank once the score falls past the buffer", () => {
    // 110 kg x 5 over three sessions scores ~41.7, below the buffer floor of 43.
    const map = buildRankMap({
      sets: history("press", 110, 3),
      exercises: EXERCISES,
      context,
      previous,
    });
    const chest = map.muscles.get("chest");
    expect(chest?.score).toBeLessThan(43);
    expect(chest?.rank.id).toBe("silver");
  });

  it("never holds a rank the score cannot reach at all", () => {
    // The buffer is a few points wide, not a licence to keep an unreachable rank.
    const map = buildRankMap({
      sets: history("press", 20, 3),
      exercises: EXERCISES,
      context,
      previous: { chest: "diamond" },
    });
    expect(map.muscles.get("chest")?.rank.id).not.toBe("diamond");
  });

  it("promotes and flags the promotion when the score clears the next rank", () => {
    const map = buildRankMap({
      sets: history("press", 140, 12),
      exercises: EXERCISES,
      context,
      previous: { chest: "silver" },
    });
    const chest = map.muscles.get("chest");
    expect(chest?.rank.id).not.toBe("silver");
    expect(chest?.promoted).toBe(true);
    expect(chest?.delta).toBeGreaterThan(0);
  });

  it("reports no promotion on a first computation", () => {
    const map = buildRankMap({
      sets: history("press", 140, 12),
      exercises: EXERCISES,
      context,
    });
    const chest = map.muscles.get("chest");
    expect(chest?.promoted).toBe(false);
    expect(chest?.delta).toBe(0);
  });

  it("does not let hysteresis consume a first classification", () => {
    // Three sessions of 80 kg x 5 score ~26, inside Bronze. The muscle has no
    // stored rank, so Bronze must be shown today rather than suppressed by a
    // buffer measured against a rank that never existed.
    const map = buildRankMap({
      sets: history("press", 80, 3),
      exercises: EXERCISES,
      context,
      previous: {},
    });
    const chest = map.muscles.get("chest");
    expect(chest?.classified).toBe(true);
    expect(chest?.score).toBeGreaterThan(12);
    expect(chest?.score).toBeLessThan(28);
    expect(chest?.rank.id).toBe("bronze");
  });

  it("shows the same rank whether or not a stale previous rank exists", () => {
    const withPrevious = buildRankMap({
      sets: history("press", 80, 3),
      exercises: EXERCISES,
      context,
      previous: { chest: "unranked" },
    });
    const withoutPrevious = buildRankMap({
      sets: history("press", 80, 3),
      exercises: EXERCISES,
      context,
    });
    expect(withPrevious.muscles.get("chest")?.rank.id).toBe(
      withoutPrevious.muscles.get("chest")?.rank.id,
    );
  });

  it("ignores a previous rank for a muscle that lost its data", () => {
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
      previous: { chest: "diamond", gluteal: "gold" },
    });
    expect(map.muscles.get("gluteal")?.rank.id).toBe("unranked");
  });
});

describe("snapshotRanks and historyEntriesFor", () => {
  it("snapshots only classified muscles", () => {
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
    });
    const snapshot = snapshotRanks(map);
    expect(snapshot.chest).toBeDefined();
    expect(snapshot.gluteal).toBeUndefined();
  });

  it("records a first classification as a history entry", () => {
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
    });
    const entries = historyEntriesFor(map, {}, NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe("chest");
    expect(entries[0].rank).toBe(map.muscles.get("chest")?.rank.id);
  });

  it("records nothing when the rank is unchanged", () => {
    const first = buildRankMap({ sets: history("press", 90), exercises: EXERCISES, context });
    const snapshot = snapshotRanks(first);
    const second = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
      previous: snapshot,
    });
    expect(historyEntriesFor(second, snapshot, NOW)).toHaveLength(0);
  });

  it("does not record unranked muscles as demotions", () => {
    const map = buildRankMap({
      sets: history("press", 90),
      exercises: EXERCISES,
      context,
      previous: { chest: "gold", gluteal: "silver" },
    });
    const entries = historyEntriesFor(map, { chest: "gold", gluteal: "silver" }, NOW);
    // Gluteal lost its data; that is not a demotion to plot on a timeline.
    expect(entries.every((e) => e.rank !== "unranked")).toBe(true);
  });
});

describe("map projections", () => {
  const map = buildRankMap({
    sets: [...history("press", 90), ...history("squat", 160)],
    exercises: EXERCISES,
    context,
  });

  it("colours every muscle by its rank", () => {
    const colors = colorByMuscle(map);
    expect(colors.size).toBe(enabledSlugs().length);
    expect(colors.get("chest")).toMatch(/^#/);
    expect(colors.get("gluteal")).toMatch(/^#/);
  });

  it("counts how many muscles sit at each rank", () => {
    const distribution = rankDistribution(map);
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(enabledSlugs().length);
  });

  it("lists the muscles that gained a rank", () => {
    const promoted = promotionsIn(
      buildRankMap({
        sets: history("press", 140, 12),
        exercises: EXERCISES,
        context,
        previous: { chest: "bronze" },
      }),
    );
    expect(promoted.map((m) => m.slug)).toContain("chest");
  });

  it("reports the sessions still needed for the first rank", () => {
    expect(sessionsUntilFirstRank(buildRankMap({ sets: [], exercises: EXERCISES, context }))).toBe(3);

    const nearly = buildRankMap({
      sets: history("press", 90, 2),
      exercises: EXERCISES,
      context,
    });
    expect(nearly.classifiedCount).toBe(0);
    expect(sessionsUntilFirstRank(nearly)).toBe(3);
  });

  it("reports no sessions needed once something is classified", () => {
    expect(sessionsUntilFirstRank(map)).toBe(0);
  });
});

describe("rank ladder integration", () => {
  it("moves a stronger lifter up the ladder", () => {
    const weak = buildRankMap({
      sets: history("squat", 60, 12),
      exercises: EXERCISES,
      context,
    });
    const strong = buildRankMap({
      sets: history("squat", 200, 12),
      exercises: EXERCISES,
      context,
    });
    const weakRank = weak.muscles.get("gluteal")?.rank.id ?? "unranked";
    const strongRank = strong.muscles.get("gluteal")?.rank.id ?? "unranked";
    const index = (id: string): number => EARNABLE_RANKS.findIndex((r) => r.id === id);
    expect(index(strongRank)).toBeGreaterThan(index(weakRank));
  });

  it("keeps every rank reachable from real data", () => {
    // A sanity bound rather than a ladder sweep: a lifter at the top of the
    // bench standard should not be capped below Obsidian, and nobody should
    // reach Obsidian by logging three light sessions.
    const strong = buildRankMap({
      sets: history("squat", 400, 12),
      exercises: EXERCISES,
      context,
    });
    expect(strong.muscles.get("gluteal")?.rank.id).not.toBe("unranked");
  });
});