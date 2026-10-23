/**
 * @vitest-environment jsdom
 *
 * ExerciseRankBadge.test.tsx — the claim has to be defensible or absent.
 *
 * This badge exists where the brief asked for a rank, and it deliberately does not show one.
 * The repo's ranks are resolved by `scoreToRank` from a 0-100 *muscle* score built out of a
 * whole region's training history; one exercise's best 1RM against a bodyweight ratio is a
 * different quantity on a different scale. Feeding the second into the first would produce a
 * confident, precisely wrong tier — 64 points means "a muscle trained hard for a year" — so
 * this shows the one thing it can defend: the percentage of the published standard, naming
 * which standard it applied.
 *
 * The tests below are mostly about the three ways it must refuse to answer, because a badge
 * that shows a number when it should show nothing is the failure that costs trust.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ExerciseRankBadge } from "./ExerciseRankBadge";
import { STANDARD_RATIOS } from "@/lib/ranks/rankConfig";

afterEach(cleanup);

function renderBadge(over: {
  target?: string;
  estimateKg?: number | null;
  bodyweightKg?: number | null;
  sex?: "male" | "female" | "other";
} = {}) {
  const {
    target = "pectorals",
    estimateKg = 140,
    bodyweightKg = 80,
    sex = "male",
  } = over;
  const { container } = render(
    <ExerciseRankBadge
      target={target}
      estimateKg={estimateKg}
      bodyweightKg={bodyweightKg}
      sex={sex}
    />,
  );
  return container.textContent ?? "";
}

describe("ExerciseRankBadge", () => {
  it("shows the percentage of the standard for a calibrated sex", () => {
    // 140kg bench on 80kg bodyweight: 1.75x, against a published male bench ratio of 1.5.
    const text = renderBadge();
    const expected = Math.round((140 / (80 * STANDARD_RATIOS.bench.male)) * 100);
    expect(text).toMatch(new RegExp(`${expected}%`));
    expect(text).toMatch(/press de banca/i);
  });

  it("uses the female table when that is the declared sex", () => {
    const male = renderBadge({ sex: "male" });
    const female = renderBadge({ sex: "female" });
    // The two tables differ, so the badge must be reading the athlete's own row. A single
    // hardcoded ratio would pass every other test in this file.
    expect(female).not.toBe(male);
  });

  it("flags the midpoint table as uncalibrated rather than presenting it as fact", () => {
    // `other` resolves to the average of the two tables: the most generous and the least
    // calibrated. Saying so is the whole point of `hasCalibratedStandard` existing.
    const text = renderBadge({ sex: "other" });
    expect(text).toMatch(/tabla intermedia/i);
    expect(text).toMatch(/no declara sexo/i);
  });

  it("shows nothing numeric without a bodyweight to divide by", () => {
    // A percentage of an unknown denominator is not a weaker claim, it is not a claim.
    const text = renderBadge({ bodyweightKg: null });
    expect(text).toMatch(/no tiene un estándar/i);
    expect(text).not.toMatch(/\d+%/);
  });

  it("shows nothing for a target the standard table does not cover", () => {
    const text = renderBadge({ target: "neck" });
    expect(text).toMatch(/no tiene un estándar/i);
    expect(text).not.toMatch(/\d+%/);
  });

  it("shows nothing for an exercise never trained", () => {
    const text = renderBadge({ estimateKg: null });
    expect(text).toMatch(/no tiene un estándar/i);
    expect(text).not.toMatch(/\d+%/);
  });

  it("refuses a bodyweight of zero rather than dividing by it", () => {
    // `0` is not missing data, it is a value no human has, and it would make the ratio
    // infinite. Treated the same as unknown: no claim.
    const text = renderBadge({ bodyweightKg: 0 });
    expect(text).not.toMatch(/%/);
  });
});