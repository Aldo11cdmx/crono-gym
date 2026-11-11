/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { WorkoutPreStartView } from "./WorkoutPreStartView";
import type { PlannedExercise } from "../../hooks/useGymData";
import type { Exercise } from "../../types/supabase";
import { sameColor } from "../../test-support/color";
import { ACCENT, TEXT } from "@/design/tokens";

afterEach(cleanup);

const norm = (s: string) =>
  s
    .replace(/\u00C2\u00B7/g, "\u00B7")
    .replace(/\u00C2/g, "")
    .replace(/Ãº/g, "\u00FA")
    .replace(/Ã¡/g, "\u00E1")
    .replace(/Ã­/g, "\u00ED")
    .replace(/Ã³/g, "\u00F3")
    .replace(/Â·/g, "\u00B7");

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
  return { exercise, target_sets, rest_seconds: 120, rowId: "row-1", order_index: 0, target_reps_min: null, target_reps_max: null, dayIndex: null, dayLabel: "" };
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

function rows(): string[] {
  const list = screen.getByRole("list", { name: "Reparto muscular" });
  return within(list).getAllByRole("listitem").map((li) => norm(li.textContent ?? ""));
}

describe("the header", () => {
  it("names the routine, and names the section after it", () => {
    renderView({ routineTitle: "Pull B" });
    expect(screen.getByRole("heading", { level: 1, name: "Pull B" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Resumen de Pull B" })).toBeTruthy();
  });

  it("counts exercises, sets and minutes together", () => {
    renderView({ planned: [plan("pectorals", 4), plan("quads", 3)] });
    expect(screen.getByText("2 ejercicios")).toBeTruthy();
    expect(screen.getByText("7 series")).toBeTruthy();
    expect(screen.getByText("15 min")).toBeTruthy();
  });

  it("agrees with itself in the singular", () => {
    renderView({ planned: [plan("biceps", 1)] });
    expect(screen.getAllByText("1 ejercicio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 serie").length).toBeGreaterThan(0);
    expect(screen.getByText("15 min")).toBeTruthy();
  });

  it("prefers the estimate it is given over its own", () => {
    renderView({ estimatedMinutes: 42 });
    expect(screen.getByText("2 ejercicios")).toBeTruthy();
    expect(screen.getByText("7 series")).toBeTruthy();
    expect(screen.getByText("42 min")).toBeTruthy();
  });
});

describe("the figure", () => {
  it("describes itself from the counts it was given", () => {
    renderView({ routineTitle: "Push A", planned: [plan("pectorals", 4), plan("biceps", 2)] });
    const figures = screen.getAllByTestId("muscle-readonly-map");
    expect(figures.length).toBeGreaterThan(0);
    expect(figures[0].getAttribute("aria-label")).toBe("Pecho y B\u00EDceps");
  });

  it("is the same figure the progress view lights", () => {
    renderView();
    expect(screen.getAllByTestId("muscle-readonly-map").length).toBeGreaterThan(0);
  });
});

describe("the distribution list", () => {
  it("lists each muscle biggest first, with its share", () => {
    renderView({
      planned: [plan("pectorals", 4), plan("quads", 2), plan("biceps", 1)],
    });
    expect(rows()).toEqual(["Pecho4 series \u00B7 57%", "Cu\u00E1driceps2 series \u00B7 29%", "B\u00EDceps1 serie \u00B7 14%"]);
  });

  it("leaves out muscles with no sets", () => {
    renderView({ planned: [plan("pectorals", 3)] });
    expect(rows()).toEqual(["Pecho3 series \u00B7 100%"]);
  });

  it("shares one denominator across every muscle, not each row its own", () => {
    renderView({ planned: [plan("pectorals", 3), plan("quads", 1)] });
    expect(rows()).toEqual(["Pecho3 series \u00B7 75%", "Cu\u00E1driceps1 serie \u00B7 25%"]);
  });

  it("aggregates across exercises hitting the same muscle", () => {
    renderView({ planned: [plan("pectorals", 3), plan("pectorals", 2)] });
    expect(rows()).toEqual(["Pecho5 series \u00B7 100%"]);
  });

  it("counts sets, not exercises", () => {
    renderView({ planned: [plan("pectorals", 3), plan("pectorals", 2)] });
    expect(rows()).toEqual(["Pecho5 series \u00B7 100%"]);
  });

  it("counts a region exercise once even when target and body part both match", () => {
    renderView({ planned: [plan("pectorals", 3, "chest")] });
    expect(rows()).toEqual(["Pecho3 series \u00B7 100%"]);
  });

  it("counts an exercise once per muscle it works", () => {
    renderView({ planned: [plan("quads", 3), plan("glutes", 3)] });
    expect(rows().sort()).toEqual(["Cu\u00E1driceps3 series \u00B7 50%", "Gl\u00FAteos3 series \u00B7 50%"]);
  });

  it("shows one row for an aliased muscle, not two", () => {
    renderView({ planned: [plan("abs", 4), plan("pectorals", 4, "chest")] });
    expect(rows()).toEqual(["Abdominales4 series \u00B7 50%", "Pecho4 series \u00B7 50%"]);
  });

  it("keeps the shares honest when an exercise could light two names", () => {
    renderView({ planned: [plan("abs", 4), plan("pectorals", 4, "chest")] });
    expect(rows().some((row) => row.includes("Oblicuos"))).toBe(false);
    expect(rows().every((row) => row.includes("50%"))).toBe(true);
  });

  it("cuts at six and says how many were left out", () => {
    renderView({ planned: EIGHT.map((t) => plan(t, 3)) });
    expect(rows()).toHaveLength(7);
    expect(rows()[6]).toMatch(/y 2 m.*sculos m.*s/);
  });

  it("says 'one more muscle' in the singular", () => {
    renderView({ planned: EIGHT.slice(0, 7).map((t) => plan(t, 3)) });
    expect(rows()[6]).toBe("y 1 m\u00FAsculo m\u00E1s");
  });

  it("does not add the rest line when everything fit", () => {
    renderView({ planned: EIGHT.slice(0, 5).map((t) => plan(t, 3)) });
    expect(rows()).toHaveLength(5);
    expect(screen.queryByText((_, el) => /m.*sculos? m.*s/.test(norm(el?.textContent ?? "")))).toBeNull();
  });

  it("renders nothing at all for an empty plan", () => {
    renderView({ planned: [] });
    expect(screen.queryByRole("list", { name: "Reparto muscular" })).toBeNull();
    expect(screen.getByText("0 ejercicios")).toBeTruthy();
    expect(screen.getAllByText("0 series").length).toBeGreaterThan(0);
    expect(screen.getByText("0 min")).toBeTruthy();
  });

  it("keeps the percentages in a mono run, right-aligned", () => {
    renderView({ planned: [plan("pectorals", 3), plan("quads", 1)] });
    const list = screen.getByRole("list", { name: "Reparto muscular" });
    const pct = within(list)
      .getAllByText((_, el) => (el?.tagName === "SPAN" && (el?.textContent ?? "").includes("75%")))
      .at(-1) as HTMLElement;
    expect(pct.style.textAlign).toBe("right");
    expect(pct.style.minWidth).toBe("4.5ch");
  });

  it("pluralises the series on its own row", () => {
    renderView({ planned: [plan("pectorals", 3), plan("biceps", 1)] });
    const list = screen.getByRole("list", { name: "Reparto muscular" });
    expect(within(list).getAllByText((_, el) => /\b3 series\b/.test(el?.textContent ?? "")).length).toBeGreaterThan(0);
    expect(within(list).getAllByText((_, el) => /\b1 serie\b/.test(el?.textContent ?? "")).length).toBeGreaterThan(0);
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
    expect(sameColor(button.style.background, ACCENT.base)).toBe(true);
    expect(button.style.width).toBe("100%");
  });

  it("carries the accent's glow", () => {
    renderView();
    const button = screen.getByRole("button", { name: /Iniciar Entrenamiento/ }) as HTMLElement;
    expect(button.style.boxShadow).toContain(ACCENT.glow);
  });

  it("inks itself with the on-accent colour rather than white", () => {
    renderView();
    const button = screen.getByRole("button", { name: /Iniciar Entrenamiento/ }) as HTMLElement;
    expect(sameColor(button.style.color, TEXT.onAccent)).toBe(true);
    expect(sameColor(button.style.color, "#FFFFFF")).toBe(false);
  });

  it("keeps the icon out of the accessible name", () => {
    renderView();
    const button = screen.getByRole("button", { name: "Iniciar Entrenamiento" });
    expect(button.querySelector("[aria-hidden='true']")).toBeTruthy();
  });
});

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
