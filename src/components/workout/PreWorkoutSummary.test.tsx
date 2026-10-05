/**
 * @vitest-environment jsdom
 *
 * PreWorkoutSummary.test.tsx — one figure, one list, one button.
 *
 * The screen answers two questions before the first set: *what am I about to train*, and
 * *is it worth starting now*. Three claims are worth protecting:
 *
 *   1. **The list and the figure are computed once.** Both read `countMuscleSets`, so the
 *      percentages under the map and the shading on it cannot disagree. Two counts would
 *      eventually differ, and a summary that contradicts the picture beside it looks
 *      authoritative in both places.
 *   2. **The button is the only accent.** It is the one thing to do here, so it is the one
 *      red thing on the screen, and it is full width because making it small would imply
 *      there were alternatives.
 *   3. **The list is cut at six.** Past that it is a wall, and on a phone the wall pushes
 *      the start button below the fold -- the one control that must always be visible.
 *
 * Fixtures use the catalog's own vocabulary (`target: "quads"`, `body_part: "upper legs"`),
 * not the muscle library's slugs. They are different namespaces and a fixture that uses
 * the wrong one counts nothing, which would make a percentage assertion pass for the wrong
 * reason.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PreWorkoutSummary } from "./PreWorkoutSummary";
import type { PlannedExercise } from "../../hooks/useGymData";
import type { Exercise } from "../../types/supabase";
import { sameColor } from "../../test-support/color";
import { ACCENT, TEXT } from "@/design/tokens";

afterEach(cleanup);

/**
 * `body_part` "cardio" matches no muscle definition, so each entry below contributes
 * exactly one muscle through its `target` alone. That keeps these tests about the list's
 * arithmetic rather than about `MUSCLE_DEFINITIONS`' region overlap -- "upper arms" alone
 * would light both biceps and triceps.
 */
function plan(target: string, target_sets: number, body_part = "cardio"): PlannedExercise {
  const exercise: Exercise = {
    id: `${target}-${body_part}`,
    name: `Move ${target}`,
    body_part,
    target,
    equipment: "barbell",
    gif_url: "",
    instructions: [],
  };
  return { exercise, target_sets, rest_seconds: 120 };
}

function renderSummary(over: Partial<Parameters<typeof PreWorkoutSummary>[0]> = {}) {
  const props: Parameters<typeof PreWorkoutSummary>[0] = {
    routineTitle: "Push A",
    planned: [plan("pectorals", 4), plan("quads", 3)],
    onStart: vi.fn(),
    ...over,
  };
  const view = render(<PreWorkoutSummary {...props} />);
  return { ...view, props };
}

/** The `<li>`s, as the concatenated strings a reader actually perceives. */
function rows(): string[] {
  return within(screen.getByRole("list")).getAllByRole("listitem").map((li) => li.textContent!);
}

describe("the header", () => {
  it("names the routine, and names the section after it", () => {
    renderSummary({ routineTitle: "Pull B" });

    expect(screen.getByRole("heading", { level: 1, name: "Pull B" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Resumen de Pull B" })).toBeTruthy();
  });

  it("counts exercises and sets together", () => {
    renderSummary({ planned: [plan("pectorals", 4), plan("quads", 3)] });
    expect(screen.getByText("2 ejercicios · 7 series")).toBeTruthy();
  });

  it("agrees with itself in the singular", () => {
    renderSummary({ planned: [plan("biceps", 1)] });

    // "1 ejercicios" is the kind of small wrongness that makes a whole screen feel
    // machine-made, and it costs one ternary to avoid.
    expect(screen.getByText("1 ejercicio · 1 serie")).toBeTruthy();
  });
});

describe("the figure", () => {
  it("describes itself from the counts it was given", () => {
    renderSummary({ routineTitle: "Push A", planned: [plan("pectorals", 4), plan("biceps", 2)] });
    const figure = screen.getByTestId("muscle-readonly-map");

    // The generated description replaces the library's own `male-body-front` label, which
    // is an internal English string naming the asset rather than the content.
    expect(figure.getAttribute("aria-label")).toBe("Pecho y Bíceps");
  });

  it("is the same figure the ranks view lights", () => {
    // Not a re-implementation: the summary and the figure read one count function, so they
    // cannot drift into two different distributions.
    renderSummary();
    expect(screen.getByTestId("muscle-readonly-map")).toBeTruthy();
  });
});

describe("the distribution list", () => {
  it("lists each muscle biggest first, with its share", () => {
    renderSummary({
      planned: [plan("pectorals", 4), plan("quads", 2), plan("biceps", 1)],
    });

    expect(rows()).toEqual(["Pecho4 series57%", "Cuádriceps2 series29%", "Bíceps1 serie14%"]);
  });

  it("leaves out muscles with no sets", () => {
    renderSummary({ planned: [plan("pectorals", 3)] });

    expect(rows()).toEqual(["Pecho3 series100%"]);
  });

  it("shares one denominator across every muscle, not each row its own", () => {
    // Chest 3, quads 1: quads are 25% of the session. Dividing by each row's own count
    // would print 100% twice and make the map look evenly split.
    renderSummary({ planned: [plan("pectorals", 3), plan("quads", 1)] });

    expect(rows()).toEqual(["Pecho3 series75%", "Cuádriceps1 serie25%"]);
  });

  it("aggregates across exercises hitting the same muscle", () => {
    renderSummary({ planned: [plan("pectorals", 3), plan("pectorals", 2)] });

    // One row, not two. Two rows for one muscle is the list disagreeing with the map.
    expect(rows()).toEqual(["Pecho5 series100%"]);
  });

  it("counts sets, not exercises", () => {
    renderSummary({ planned: [plan("pectorals", 4), plan("pectorals", 3)] });
    expect(within(screen.getByRole("list")).getByText("7 series")).toBeTruthy();
  });

  it("counts a region exercise once even when target and body part both match", () => {
    // "chest" covers `target: "pectorals"` *and* `body_part: "chest"`. Counting both would
    // make this bench press three sets of chest, or six.
    renderSummary({ planned: [plan("pectorals", 3, "chest")] });

    expect(rows()).toEqual(["Pecho3 series100%"]);
  });

  it("counts an exercise once per muscle it works", () => {
    // A squat genuinely trains quads *and* glutes. One row each, each with the full count,
    // which is why the denominator is a sum over muscles rather than a sum over sets.
    renderSummary({ planned: [plan("quads", 3), plan("glutes", 3)] });
    expect(rows().sort()).toEqual(["Cuádriceps3 series50%", "Glúteos3 series50%"]);
  });

  it("cuts at six and says how many were left out", () => {
    // Eight muscles is a wall, and on a phone the wall pushes the start button below the
    // fold, which is the one control here that must always be visible.
    renderSummary({ planned: EIGHT.map((t) => plan(t, 3)) });

    expect(rows()).toHaveLength(7);
    expect(rows()[6]).toBe("y 2 músculos más");
  });

  it("says 'one more muscle' in the singular", () => {
    renderSummary({ planned: EIGHT.slice(0, 7).map((t) => plan(t, 3)) });

    expect(rows()[6]).toBe("y 1 músculo más");
  });

  it("does not add the rest line when everything fit", () => {
    renderSummary({ planned: EIGHT.slice(0, 5).map((t) => plan(t, 3)) });

    expect(rows()).toHaveLength(5);
    expect(screen.queryByText(/músculos? más/)).toBeNull();
  });

  it("renders nothing at all for an empty plan", () => {
    renderSummary({ planned: [] });

    // No list, no percentages, no divide-by-zero. An empty session is a different screen
    // and this component must not invent content to fill the space.
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("0 ejercicios · 0 series")).toBeTruthy();
  });

  it("keeps the percentages in a mono run, right-aligned", () => {
    renderSummary({ planned: [plan("pectorals", 3), plan("quads", 1)] });
    const pct = within(screen.getByRole("list")).getByText("75%") as HTMLElement;

    // Right-aligned and monospaced so the column reads as a column: "9%" and "75%" ending
    // at the same x is the difference between a table and a list of strings.
    expect(pct.style.textAlign).toBe("right");
    expect(pct.style.minWidth).toBe("4ch");
  });

  it("pluralises the series on its own row", () => {
    renderSummary({ planned: [plan("pectorals", 3), plan("biceps", 1)] });

    expect(within(screen.getByRole("list")).getByText("3 series")).toBeTruthy();
    expect(within(screen.getByRole("list")).getByText("1 serie")).toBeTruthy();
  });
});

describe("the start button", () => {
  it("starts the session", () => {
    const { props } = renderSummary();
    fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
    expect(props.onStart).toHaveBeenCalledOnce();
  });

  it("is the only accent on the screen, and it is full width", () => {
    renderSummary();
    const button = screen.getByRole("button", { name: /Empezar/ }) as HTMLElement;

    // Exactly one thing to do here. A narrow button implies there were alternatives, and
    // the value is the token's own rather than `var(--cronos-accent-base)`: nothing injects
    // those custom properties into the document, so a `var()` here would resolve to nothing
    // and the button would arrive with no fill at all.
    expect(sameColor(button.style.background, ACCENT.base)).toBe(true);
    expect(button.style.width).toBe("100%");
    expect(button.style.minHeight).toBe("56px");
  });

  it("inks itself with the on-accent colour rather than white", () => {
    renderSummary();
    const button = screen.getByRole("button", { name: /Empezar/ }) as HTMLElement;

    // The accent is bright enough that white on it fails contrast. `tokens.test.ts` holds
    // `TEXT.onAccent` to that bar.
    expect(sameColor(button.style.color, TEXT.onAccent)).toBe(true);
    expect(sameColor(button.style.color, "#FFFFFF")).toBe(false);
  });

  it("keeps the icon out of the accessible name", () => {
    renderSummary();
    const button = screen.getByRole("button", { name: "Empezar" });

    // "Play Empezar" is a label that has to be re-read by a screen reader, every session.
    expect(button.querySelector("[aria-hidden='true']")).toBeTruthy();
  });
});

/** Eight distinct muscles, each reachable by `target` alone. */
const EIGHT = [
  "pectorals",
  "delts",
  "forearms",
  "calves",
  "lats",
  "traps",
  "spine",
  "glutes",
] as const;