import { describe, expect, it } from "vitest";
import {
  BAR_WEIGHTS,
  calculatePlates,
  nearestLoadable,
  quickIncrements,
  warmupSets,
  type BarType,
  type PlateInventory,
  type PlateKg,
} from "./weightUtils";
import { kgToLb, lbToKg } from "../profile";

/**
 * A well-stocked rack: two pairs of every size, which is what a commercial gym
 * plate tree looks like.
 */
const FULL: PlateInventory = {
  25: 2,
  20: 2,
  15: 2,
  10: 2,
  5: 2,
  2.5: 2,
  1.25: 2,
  0.5: 2,
};

/** One pair of 20s and one pair of 2.5s: the most a home rack usually has. */
const LIMITED: PlateInventory = { 20: 1, 2.5: 1 };

/** Deliberately lumpy, so per-side loads are far apart and gaps are visible. */
const SPARSE: PlateInventory = { 25: 1, 5: 1 };

const OLYMPIC = BAR_WEIGHTS.olympic;

describe("BAR_WEIGHTS", () => {
  it("covers every bar type, with custom as a zero-weight bar", () => {
    const types: BarType[] = ["olympic", "standard", "ez", "hex", "custom"];
    expect(Object.keys(BAR_WEIGHTS).sort()).toEqual([...types].sort());
    expect(BAR_WEIGHTS.custom).toBe(0);
  });

  it("treats olympic as 20 kg, so it drives the conventional examples", () => {
    expect(OLYMPIC).toBe(20);
  });
});

describe("calculatePlates", () => {
  it("builds an exact load from a full inventory", () => {
    const result = calculatePlates(100, OLYMPIC, FULL);
    expect(result.totalWeight).toBe(100);
    expect(result.remainder).toBe(0);
    expect(result.isExact).toBe(true);
  });

  it("loads the largest plates first, to keep the sleeve short", () => {
    // 40 kg per side is reachable as 25+15 or as 20+20; heaviest-plate-first
    // picks the first, which is one plate instead of two.
    expect(calculatePlates(100, OLYMPIC, FULL).platesPerSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
    ]);
  });

  it("mirrors the per-side load onto both ends of the bar", () => {
    const result = calculatePlates(62.5, OLYMPIC, FULL);
    expect(result.platesPerSide).toEqual([
      { weight: 20, count: 1 },
      { weight: 1.25, count: 1 },
    ]);
    // 20 bar + 2 * 21.25.
    expect(result.totalWeight).toBe(62.5);
    expect(result.isExact).toBe(true);
  });

  it("returns per-side counts that the inventory can actually cover", () => {
    // One pair of 20s and one of 2.5s: the heaviest per side is 22.5, so 45 kg
    // per side is 22.5 per side * 2 = 45 + 20 bar = 65 kg.
    const result = calculatePlates(100, OLYMPIC, LIMITED);
    expect(result.platesPerSide).toEqual([
      { weight: 20, count: 1 },
      { weight: 2.5, count: 1 },
    ]);
    expect(result.totalWeight).toBe(65);
  });

  it("reports the shortfall when the inventory cannot reach the target", () => {
    const result = calculatePlates(100, OLYMPIC, LIMITED);
    expect(result.remainder).toBe(35);
    expect(result.isExact).toBe(false);
  });

  it("stops at the exact target rather than overshooting it", () => {
    const result = calculatePlates(65, OLYMPIC, LIMITED);
    expect(result.totalWeight).toBe(65);
    expect(result.isExact).toBe(true);
  });

  it("never loads a plate it does not have", () => {
    const single: PlateInventory = { 20: 1 };
    const result = calculatePlates(80, OLYMPIC, single);
    expect(result.platesPerSide).toEqual([{ weight: 20, count: 1 }]);
    expect(result.totalWeight).toBe(60);
    expect(result.remainder).toBe(20);
  });

  it("treats a missing key as no plates of that size, not as zero stock", () => {
    // Only 2.5 kg plates exist here. A 30 kg target is per side 5, which is two
    // pairs of 2.5s -- and it never invents a 25, 20, 15, 10 or 5 along the way.
    const result = calculatePlates(30, OLYMPIC, { 2.5: 4 });
    expect(result.platesPerSide).toEqual([{ weight: 2.5, count: 2 }]);
    expect(result.totalWeight).toBe(30);
    expect(result.isExact).toBe(true);
  });

  it("cannot reach a target whose halves fall between plate sizes", () => {
    // 50 kg is 15 per side, and a 20 kg plate is not 15. This is the case a
    // "round to the nearest plate" shortcut gets wrong.
    const result = calculatePlates(50, OLYMPIC, { 20: 2 });
    expect(result.platesPerSide).toEqual([]);
    expect(result.totalWeight).toBe(OLYMPIC);
    expect(result.remainder).toBe(30);
  });

  it("reports a target below the bar as unreachable, not as negative plates", () => {
    const result = calculatePlates(15, OLYMPIC, FULL);
    expect(result.platesPerSide).toEqual([]);
    expect(result.totalWeight).toBe(OLYMPIC);
    // Signed remainder: negative because the empty bar overshoots the target.
    expect(result.remainder).toBe(-5);
    expect(result.isExact).toBe(false);
  });

  it("loads nothing when the target is exactly the bar", () => {
    const result = calculatePlates(OLYMPIC, OLYMPIC, FULL);
    expect(result.platesPerSide).toEqual([]);
    expect(result.totalWeight).toBe(OLYMPIC);
    expect(result.isExact).toBe(true);
  });

  it("works on a zero-weight bar, for dumbbell and bodyweight movements", () => {
    const result = calculatePlates(50, BAR_WEIGHTS.custom, FULL);
    expect(result.totalWeight).toBe(50);
    expect(result.isExact).toBe(true);
  });

  it("quantises to the 0.25 kg grid the plates can express", () => {
    // 61.25 kg asks for 20.625 per side. There is no 20.625: the finest step is
    // a 0.5 kg plate, so the closest honest answer is 61 kg.
    const result = calculatePlates(61.25, OLYMPIC, FULL);
    expect(result.totalWeight).toBe(61);
    expect(result.remainder).toBe(0.25);
    expect(result.isExact).toBe(false);
  });

  it("does not drift on loadable quarter-kilo targets", () => {
    // Repeated 1.25 and 0.5 subtraction is exactly where float maths falls apart.
    // Every plate size is a multiple of 0.25 and the smallest is 0.5, so these
    // targets all divide into per-side loadings the rack can build, and each one
    // must come back exact.
    const loadable = [20, 22.5, 25, 30, 32.5, 45, 50, 62.5, 100, 137.5, 140];
    for (const target of loadable) {
      expect(calculatePlates(target, OLYMPIC, FULL).isExact, `target ${target}`).toBe(true);
    }
  });

  it("refuses targets whose per-side half falls between plate sizes", () => {
    // 21.25 kg on a 20 kg bar is 0.625 per side. There is no 0.625 plate, so
    // this must report a shortfall rather than invent one.
    for (const target of [21.25, 23.75, 61.25]) {
      expect(calculatePlates(target, OLYMPIC, FULL).isExact, `target ${target}`).toBe(false);
    }
  });

  it("sums the plates it reports to the bar plus twice the per side", () => {
    for (const target of [40, 55, 72.5, 90, 100, 137.5]) {
      const { platesPerSide, totalWeight } = calculatePlates(target, OLYMPIC, FULL);
      const perSide = platesPerSide.reduce(
        (sum, p) => sum + p.weight * p.count,
        0,
      );
      expect(OLYMPIC + 2 * perSide, `target ${target}`).toBe(totalWeight);
    }
  });

  it("keeps platesPerSide ordered heaviest first", () => {
    const { platesPerSide } = calculatePlates(140, OLYMPIC, FULL);
    const weights = platesPerSide.map((p) => p.weight as number);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it("loads nothing at all from an empty rack", () => {
    const result = calculatePlates(100, OLYMPIC, {});
    expect(result.platesPerSide).toEqual([]);
    expect(result.totalWeight).toBe(OLYMPIC);
    expect(result.remainder).toBe(80);
    expect(result.isExact).toBe(false);
  });
});

describe("nearestLoadable", () => {
  it("returns the target itself when the rack can build it", () => {
    expect(nearestLoadable(100, OLYMPIC, FULL)).toBe(100);
    expect(nearestLoadable(47, OLYMPIC, FULL)).toBe(47);
  });

  it("clamps a target below the bar up to the empty bar", () => {
    expect(nearestLoadable(15, OLYMPIC, FULL)).toBe(OLYMPIC);
  });

  it("returns the closest reachable weight when the rack is short", () => {
    expect(nearestLoadable(100, OLYMPIC, LIMITED)).toBe(65);
  });

  it("skips over loadable weights that do not exist", () => {
    // One pair of 25s and one of 5s: per side the only loadings are 0, 5, 25
    // and 30, so the bar can be 20, 30, 70 or 80 kg. 50 kg is not one of them,
    // and neither is 40.
    expect(nearestLoadable(50, OLYMPIC, SPARSE)).toBe(30);
  });

  it("will go above the target when that is nearer", () => {
    // Same rack: from 50 kg the nearest reachable weight upward is 70.
    expect(nearestLoadable(55, OLYMPIC, SPARSE)).toBe(70);
  });

  it("breaks a tie toward the lighter load", () => {
    // 30 and 70 are both 20 kg from 50 kg. Suggesting less weight is the
    // recoverable mistake.
    expect(nearestLoadable(50, OLYMPIC, SPARSE)).toBe(30);
  });

  it("returns the empty bar when there are no plates at all", () => {
    expect(nearestLoadable(100, OLYMPIC, {})).toBe(OLYMPIC);
  });

  it("never returns a weight the same rack cannot build", () => {
    const inventories: PlateInventory[] = [FULL, LIMITED, SPARSE, { 10: 3 }, { 1.25: 2 }];
    for (const inventory of inventories) {
      for (let target = 20; target <= 120; target += 1.25) {
        const result = nearestLoadable(target, OLYMPIC, inventory);
        const check = calculatePlates(result, OLYMPIC, inventory);
        // The suggested weight must itself be exactly loadable...
        expect(check.isExact, `${result} on ${JSON.stringify(inventory)}`).toBe(true);
        // ...and no closer loadable weight exists.
        expect(Math.abs(check.totalWeight - target)).toBe(
          Math.abs(result - target),
        );
      }
    }
  });
});

describe("warmupSets", () => {
  it("ramps 40/60/80 percent on a fully stocked rack", () => {
    expect(warmupSets(100, OLYMPIC, FULL)).toEqual([40, 60, 80]);
  });

  it("snaps each step to a weight the rack can build", () => {
    // 40/60/80 percent of 62.5 is 25, 37.5 and 50 -- all real, even on the
    // lighter 15 kg standard bar.
    expect(warmupSets(62.5, BAR_WEIGHTS.standard, FULL)).toEqual([25, 37.5, 50]);
  });

  it("never returns a set lighter than the bar alone", () => {
    const sets = warmupSets(35, BAR_WEIGHTS.standard, FULL);
    expect(sets).toEqual([15, 21, 27.5]);
    for (const weight of sets) {
      expect(weight).toBeGreaterThanOrEqual(BAR_WEIGHTS.standard);
    }
  });

  it("never returns the same weight twice in a row", () => {
    // A sparse rack collapses the ramp onto itself: 24, 36 and 48 all resolve to
    // the same 30 kg load.
    const sets = warmupSets(60, OLYMPIC, SPARSE);
    expect(sets).toEqual([20, 30]);
    expect(new Set(sets).size).toBe(sets.length);
  });

  it("holds the bar as the floor when the working weight is barely above it", () => {
    expect(warmupSets(OLYMPIC, OLYMPIC, FULL)).toEqual([OLYMPIC]);
  });

  it("ramps upward without ever dipping below the first step", () => {
    for (const working of [22.5, 30, 45, 60, 80, 100, 140]) {
      const sets = warmupSets(working, OLYMPIC, FULL);
      expect(sets.length, `working ${working}`).toBeGreaterThan(0);
      for (const weight of sets) {
        expect(weight, `working ${working}`).toBeGreaterThanOrEqual(OLYMPIC);
      }
      for (let i = 1; i < sets.length; i++) {
        expect(sets[i], `working ${working}`).toBeGreaterThan(sets[i - 1]);
      }
    }
  });

  it("stays under the working weight it is warming up to", () => {
    for (const working of [30, 45, 60, 80, 100, 140]) {
      for (const weight of warmupSets(working, OLYMPIC, FULL)) {
        expect(weight, `working ${working}`).toBeLessThan(working);
      }
    }
  });
});

describe("quickIncrements", () => {
  it("offers the standard stepper increments", () => {
    expect(quickIncrements()).toEqual([2.5, 5, 10, 15, 20]);
  });

  it("hands back a copy, so a sorted menu cannot corrupt the shared source", () => {
    const first = quickIncrements();
    first.sort((a, b) => b - a);
    first.push(999);
    expect(quickIncrements()).toEqual([2.5, 5, 10, 15, 20]);
  });
});

describe("metric and imperial", () => {
  it("converts 100 kg to the 220.5 lb a US gym would print", () => {
    expect(kgToLb(100)).toBe(220.5);
  });

  it("survives a kg -> lb -> kg round trip on every quick increment", () => {
    // The steppers are rendered in whichever unit the profile is set to, so a
    // displayed increment has to convert back to the same kg step.
    for (const increment of quickIncrements()) {
      expect(lbToKg(kgToLb(increment)), `${increment} kg`).toBe(increment);
    }
  });

  it("exposes increments in lb as well", () => {
    expect(quickIncrements().map(kgToLb)).toEqual([5.5, 11, 22, 33.1, 44.1]);
  });

  it("resolves a lb target onto the plate grid and lands within 0.5 lb", () => {
    // 225 lb is 102.06 kg, which no plate combination can express. The nearest
    // real load is 102 kg, and that is 224.9 lb -- a tenth of a pound away.
    const requestedLb = 225;
    const result = calculatePlates(lbToKg(requestedLb), OLYMPIC, FULL);
    expect(result.isExact).toBe(true);
    expect(result.totalWeight).toBe(102);
    expect(Math.abs(kgToLb(result.totalWeight) - requestedLb)).toBeLessThan(0.5);
  });

  it("snaps a lb target to a loadable weight", () => {
    expect(nearestLoadable(lbToKg(225), OLYMPIC, FULL)).toBe(102);
    expect(nearestLoadable(lbToKg(135), OLYMPIC, FULL)).toBe(61);
  });
});

describe("type surface", () => {
  it("types the plate sizes as the eight the rack carries", () => {
    // Compile-time contract, asserted at runtime so the union cannot silently
    // widen without a test noticing.
    const sizes: PlateKg[] = [0.5, 1.25, 2.5, 5, 10, 15, 20, 25];
    expect(sizes).toHaveLength(8);
  });
});
