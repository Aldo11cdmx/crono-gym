/**
 * @vitest-environment jsdom
 *
 * WorkoutPreStartView.test.tsx — one figure, one distribution, one list, one button.
 *
 * The screen answers two questions before the first set: *what am I about to train*, and
 * *is it worth starting now*. Four claims are worth protecting:
 *
 *   1. **The list and the figure are computed once.** Both read `countMuscleSets`, so the
 *      percentages under the map and the shading on it cannot disagree. Two counts would
 *      eventually differ, and a summary that contradicts the picture beside it looks
 *      authoritative in both places.
 *   2. **The figure is the one the progress view lights.** The pre-workout map is
 *      `MuscleReadonlyMap`, the same component the dashboard hero and the demo tab
 *      use, so the two cannot drift into two different anatomies.
 *   3. **The button is the only accent.** It is the one thing to do here, so it is the one
 *      red thing on the screen, and it is full width because making it small would imply
 *      there were alternatives.
 *   4. **The list is cut at six.** Past that it is a wall, and on a phone the wall pushes
 *      the start button below the fold -- the one control that must always be visible.
 *
 * Fixtures use the catalog's own vocabulary (`target: "quads"`, `body_part: "upper legs"`),
 * not the muscle library's slugs. They are different namespaces and a fixture that uses
 * the wrong one counts nothing, which would make a percentage assertion pass for the wrong
 * reason.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { WorkoutPreStartView } from "./WorkoutPreStartView";
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
    name_es: null,
    is_active: true,
    is_hidden: false,
  };
  return { exercise, target_sets, rest_seconds: 120, dayIndex: null, dayLabel: "" };
}

function renderView(over: Partial<Parameters<typeof WorkoutPreStartView>[0]> = {}) {
  const props: Parameters<typeof WorkoutPreStartView>[0] = {
    routineTitle: "Push A",
    planned: [plan("pectorals", 4), plan("quads", 3)],
    onStart: vi.fn(),
    ...over,
  };
  const view = render(<WorkoutPreStartView {...props} />);
  return { ...view, props };
}

/** The distribution rows, as the concatenated strings a reader actually perceives. */
function rows(): string[] {
  const list = screen.getByRole("list", { name: "Reparto muscular" });
  return within(list).getAllByRole("listitem").map((li) => li.textContent!);
}

describe("the header", () => {
  it("names the routine, and names the section after it", () => {
    renderView({ routineTitle: "Pull B" });

    expect(screen.getByRole("heading", { level: 1, name: "Pull B" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Resumen de Pull B" })).toBeTruthy();
  });

  it("counts exercises, sets and minutes together", () => {
    renderView({ planned: [plan("pectorals", 4), plan("quads", 3)] });
    expect(screen.getByText("2 ejercicios · 7 series · 15 min")).toBeTruthy();
  });

  it("agrees with itself in the singular", () => {
    renderView({ planned: [plan("biceps", 1)] });

    // "1 ejercicios" is the kind of small wrongness that makes a whole screen feel
    // machine-made, and it costs one ternary to avoid.
    expect(screen.getByText("1 ejercicio · 1 serie · 15 min")).toBeTruthy();
  });

  it("prefers the estimate it is given over its own", () => {
    renderView({ estimatedMinutes: 42 });
    expect(screen.getByText("2 ejercicios · 7 series · 42 min")).toBeTruthy();
  });
});

describe("the figure", () => {
  it("describes itself from the counts it was given", () => {
    renderView({ routineTitle: "Push A", planned: [plan("pectorals", 4), plan("biceps", 2)] });
    const figure = screen.getByTestId("muscle-readonly-map");

    // The generated description replaces the library's own `male-body-front` label, which
    // is an internal English string naming the asset rather than the content.
    expect(figure.getAttribute("aria-label")).toBe("Pecho y Bíceps");
  });

  it("is the same figure the progress view lights", () => {
    // Not a re-implementation: the summary and the figure read one count function, so they
    // cannot drift into two different distributions.
    renderView();
    expect(screen.getByTestId("muscle-readonly-map")).toBeTruthy();
  });
});

describe("the distribution list", () => {
  it("lists each muscle biggest first, with its share", () => {
    renderView({
      planned: [plan("pectorals", 4), plan("quads", 2), plan("biceps", 1)],
    });

    expect(rows()).toEqual(["Pecho4 series57%", "Cuádriceps2 series29%", "Bíceps1 serie14%"]);
  });

  it("leaves out muscles with no sets", () => {
    renderView({ planned: [plan("pectorals", 3)] });
    expect(rows()).toEqual(["Pecho3 series100%"]);
  });

  it("shares one denominator across every muscle, not each row its own", () => {
    // Chest 3, quads 1: quads are 25% of the session. Dividing by each row's own count
    // would print 100% twice and make the map look evenly split.
    renderView({ planned: [plan("pectorals", 3), plan("quads", 1)] });

    expect(rows()).toEqual(["Pecho3 series75%", "Cuádriceps1 serie25%"]);
  });

  it("aggregates across exercises hitting the same muscle", () => {
    renderView({ planned: [plan("pectorals", 3), plan("pectorals", 2)] });

    // One row, not two. Two rows for one muscle is the list disagreeing with the map.
    expect(rows()).toEqual(["Pecho5 series100%"]);
  });

  it("counts sets, not exercises", () => {
    renderView({ planned: [plan("pectorals", 4), plan("pectorals", 3)] });
    expect(within(screen.getByRole("list", { name: "Reparto muscular" })).getByText("7 series")).toBeTruthy();
  });

  it("counts a region exercise once even when target and body part both match", () => {
    // "chest" covers `target: "pectorals"` *and* `body_part: "chest"`. Counting both would
    // make this bench press three sets of chest, or six.
    renderView({ planned: [plan("pectorals", 3, "chest")] });

    expect(rows()).toEqual(["Pecho3 series100%"]);
  });

  it("counts an exercise once per muscle it works", () => {
    // A squat genuinely trains quads *and* glutes. One row each, each with the full count,
    // which is why the denominator is a sum over muscles rather than a sum over sets.
    renderView({ planned: [plan("quads", 3), plan("glutes", 3)] });
    expect(rows().sort()).toEqual(["Cuádriceps3 series50%", "Glúteos3 series50%"]);
  });

  it("shows one row for an aliased muscle, not two", () => {
    // `obliques` is declared `aliasOf: "abs"` -- the same coverage under two names. Two rows
    // here would print the same four sets twice and halve every other muscle's share.
    renderView({ planned: [plan("abs", 4), plan("pectorals", 4, "chest")] });

    expect(rows()).toEqual(["Abdominales4 series50%", "Pecho4 series50%"]);
  });

  it("keeps the shares honest when an exercise could light two names", () => {
    // The symptom this protects against: "Abdominales 33%, Oblicuos 33%, Pecho 33%" for a
    // session that is half abs and half chest.
    renderView({ planned: [plan("abs", 4), plan("pectorals", 4, "chest")] });

    expect(rows().some((row) => row.includes("Oblicuos"))).toBe(false);
    expect(rows().every((row) => row.includes("50%"))).toBe(true);
  });

  it("cuts at six and says how many were left out", () => {
    // Eight muscles is a wall, and on a phone the wall pushes the start button below the
    // fold, which is the one control here that must always be visible.
    renderView({ planned: EIGHT.map((t) => plan(t, 3)) });

    expect(rows()).toHaveLength(7);
    expect(rows()[6]).toBe("y 2 músculos más");
  });

  it("says 'one more muscle' in the singular", () => {
    renderView({ planned: EIGHT.slice(0, 7).map((t) => plan(t, 3)) });
    expect(rows()[6]).toBe("y 1 músculo más");
  });

  it("does not add the rest line when everything fit", () => {
    renderView({ planned: EIGHT.slice(0, 5).map((t) => plan(t, 3)) });

    expect(rows()).toHaveLength(5);
    expect(screen.queryByText(/músculos? más/)).toBeNull();
  });

  it("renders nothing at all for an empty plan", () => {
    renderView({ planned: [] });

    // No list, no percentages, no divide-by-zero. An empty session is a different screen
    // and this component must not invent content to fill the space.
    expect(screen.queryByRole("list", { name: "Reparto muscular" })).toBeNull();
    expect(screen.getByText("0 ejercicios · 0 series · 0 min")).toBeTruthy();
  });

  it("keeps the percentages in a mono run, right-aligned", () => {
    renderView({ planned: [plan("pectorals", 3), plan("quads", 1)] });
    const pct = within(screen.getByRole("list", { name: "Reparto muscular" })).getByText("75%") as HTMLElement;

    // Right-aligned and monospaced so the column reads as a column: "9%" and "75%" ending
    // at the same x is the difference between a table and a list of strings.
    expect(pct.style.textAlign).toBe("right");
    expect(pct.style.minWidth).toBe("4ch");
  });

  it("pluralises the series on its own row", () => {
    renderView({ planned: [plan("pectorals", 3), plan("biceps", 1)] });

    expect(within(screen.getByRole("list", { name: "Reparto muscular" })).getByText("3 series")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Reparto muscular" })).getByText("1 serie")).toBeTruthy();
  });
});

describe("the exercise list", () => {
  it("names every planned exercise with its set count", () => {
    renderView({ planned: [plan("pectorals", 4), plan("quads", 3)] });
    const list = screen.getByRole("list", { name: "Ejercicios planeados" });

    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Move pectorals4 series",
      "Move quads3 series",
    ]);
  });

  it("is not drawn for an empty plan", () => {
    renderView({ planned: [] });
    expect(screen.queryByRole("list", { name: "Ejercicios planeados" })).toBeNull();
  });
});

describe("the exit", () => {
  it("offers no way out when there is nowhere to go back to", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /Volver/ })).toBeNull();
  });

  it("leaves through a discreet secondary button", () => {
    const onExit = vi.fn();
    renderView({ onExit });

    const button = screen.getByRole("button", { name: /Volver/ }) as HTMLElement;

    // Ghost, not a second filled action: leaving is an option, not what the athlete
    // came here to do, and two filled buttons would say the screen asks two questions
    // at once.
    expect(button.style.background).toBe("transparent");
    expect(button.style.minHeight).toBe("44px");

    fireEvent.click(button);
    expect(onExit).toHaveBeenCalledOnce();
  });
});

describe("the start button", () => {
  it("starts the session", () => {
    const { props } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar Entrenamiento/ }));
    expect(props.onStart).toHaveBeenCalledOnce();
  });

  it("is the only accent on the screen, and it is full width", () => {
    renderView();
    const button = screen.getByRole("button", { name: /Iniciar Entrenamiento/ }) as HTMLElement;

    // Exactly one thing to do here. A narrow button implies there were alternatives, and
    // the value is the token's own rather than `var(--cronos-accent-base)`: nothing injects
    // those custom properties into the document, so a `var()` here would resolve to nothing
    // and the button would arrive with no fill at all.
    expect(sameColor(button.style.background, ACCENT.base)).toBe(true);
    expect(button.style.width).toBe("100%");
  });

  it("carries the accent's glow", () => {
    renderView();
    const button = screen.getByRole("button", { name: /Iniciar Entrenamiento/ }) as HTMLElement;

    // The halo the brief asks for, and the same token the rest of the product uses for a
    // primary action's cast.
    expect(button.style.boxShadow).toContain(ACCENT.glow);
  });

  it("inks itself with the on-accent colour rather than white", () => {
    renderView();
    const button = screen.getByRole("button", { name: /Iniciar Entrenamiento/ }) as HTMLElement;

    // The accent is bright enough that white on it fails contrast. `tokens.test.ts` holds
    // `TEXT.onAccent` to that bar.
    expect(sameColor(button.style.color, TEXT.onAccent)).toBe(true);
    expect(sameColor(button.style.color, "#FFFFFF")).toBe(false);
  });

  it("keeps the icon out of the accessible name", () => {
    renderView();
    const button = screen.getByRole("button", { name: "Iniciar Entrenamiento" });

    // "Play Iniciar Entrenamiento" is a label that has to be re-read by a screen reader,
    // every session.
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
