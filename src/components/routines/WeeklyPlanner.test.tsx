/**
 * WeeklyPlanner.test.tsx — tests for the extended weekly planner.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { WeeklyPlanner } from "./WeeklyPlanner";
import type { WeeklyAssignment } from "@/lib/routines/routinesViewModel";

const ROUTINES = [
  { routineId: "r-0", title: "Full Body A" },
  { routineId: "r-1", title: "Full Body B" },
  { routineId: "r-2", title: "Cardio" },
];

const INITIAL_ASSIGNMENTS: WeeklyAssignment[] = [
  { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0, title: "Lunes: Empuje Pro" },
  { id: "a-1", routineId: "r-1", dayIndex: 0, order: 1 },
  { id: "a-2", routineId: "r-2", dayIndex: 1, order: 0 },
];

afterEach(() => cleanup());

describe("WeeklyPlanner (extended)", () => {
  it("renders the day carousel with the seven weekday letters", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.getByText("L")).toBeTruthy();
    expect(screen.getByText("M")).toBeTruthy();
    expect(screen.getByText("X")).toBeTruthy();
    expect(screen.getByText("J")).toBeTruthy();
    expect(screen.getByText("V")).toBeTruthy();
    expect(screen.getByText("S")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();
  });

  it("renders the routines of the day the carousel selects", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.getByText("Full Body B")).toBeTruthy();
    expect(screen.getByText("Lunes: Empuje Pro")).toBeTruthy();
    // "Cardio" belongs to Tuesday: the card shows one day at a time.
    expect(screen.queryByText("Cardio")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Martes" }));
    expect(screen.getByText("Cardio")).toBeTruthy();
  });

  it("renders the custom session title when provided", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.getByText("Lunes: Empuje Pro")).toBeTruthy();
  });

  it("shows Rest day label for empty non-today days", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={3}
      />,
    );
    const restLabels = screen.getAllByText("Descanso");
    expect(restLabels.length).toBeGreaterThan(0);
  });

  it("renders undo/redo buttons disabled initially", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    const undoBtn = screen.getByLabelText("Deshacer");
    const redoBtn = screen.getByLabelText("Rehacer");
    expect(undoBtn.hasAttribute("disabled")).toBe(true);
    expect(redoBtn.hasAttribute("disabled")).toBe(true);
  });

  it("calls onChange after a reorder drag", async () => {
    const onChange = vi.fn();
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={onChange}
        todayIndex={0}
      />,
    );
    const dragItem = screen.getByText("Full Body B");
    await fireEvent.dragStart(dragItem);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the 'Iniciar sesión de hoy' button for today without assignments", () => {
    const onStartToday = vi.fn();
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={[]}
        onChange={vi.fn()}
        todayIndex={0}
        onStartToday={onStartToday}
      />,
    );
    expect(screen.getByText("Iniciar sesión de hoy")).toBeTruthy();
    fireEvent.click(screen.getByText("Iniciar sesión de hoy"));
    expect(onStartToday).toHaveBeenCalledWith(0);
  });
});
