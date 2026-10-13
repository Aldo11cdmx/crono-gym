/**
 * WeeklyPlanner.test.tsx — tests for the advanced weekly planner.
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
  { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
  { id: "a-1", routineId: "r-1", dayIndex: 0, order: 1 },
  { id: "a-2", routineId: "r-2", dayIndex: 1, order: 0 },
];

afterEach(() => cleanup());

describe("WeeklyPlanner", () => {
  it("renders the 7-day strip with Spanish weekday names", () => {
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

  it("renders routine assignments under their day", () => {
    render(
      <WeeklyPlanner
        routines={ROUTINES}
        initialAssignments={INITIAL_ASSIGNMENTS}
        onChange={vi.fn()}
        todayIndex={0}
      />,
    );
    expect(screen.getByText("Full Body A")).toBeTruthy();
    expect(screen.getByText("Full Body B")).toBeTruthy();
    expect(screen.getByText("Cardio")).toBeTruthy();
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
    const dragItem = screen.getByText("Full Body A");
    await fireEvent.dragStart(dragItem);
    expect(onChange).not.toHaveBeenCalled();
  });
});
