/**
 * routinesViewModel.test.ts — tests for the immutable weekly assignment model.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import {
  type WeeklyAssignment,
  AssignmentHistory,
  assignToDay,
  moveAssignmentToDay,
  reorderAssignments,
  shiftDayForward,
  skipDay,
} from "./routinesViewModel";

function makeAssignments(
  count: number,
  dayIndex = 0,
): WeeklyAssignment[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `a-${i}`,
    routineId: `r-${i}`,
    dayIndex,
    order: i,
  }));
}

describe("reorderAssignments", () => {
  it("moves an item forward in the array", () => {
    const input = makeAssignments(3);
    const result = reorderAssignments(input, 0, 2);
    expect(result.map((a) => a.routineId)).toEqual(["r-1", "r-2", "r-0"]);
  });

  it("moves an item backward in the array", () => {
    const input = makeAssignments(3);
    const result = reorderAssignments(input, 2, 0);
    expect(result.map((a) => a.routineId)).toEqual(["r-2", "r-0", "r-1"]);
  });

  it("reorders orders to be contiguous starting at 0", () => {
    const input = makeAssignments(4);
    const result = reorderAssignments(input, 3, 0);
    expect(result.map((a) => a.order)).toEqual([0, 1, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const input = makeAssignments(3);
    const original = input.map((a) => ({ ...a }));
    reorderAssignments(input, 0, 2);
    expect(input).toEqual(original);
  });

  it("returns a new array instance", () => {
    const input = makeAssignments(3);
    expect(reorderAssignments(input, 0, 2)).not.toBe(input);
  });

  it("returns a shallow copy when from === to", () => {
    const input = makeAssignments(3);
    const result = reorderAssignments(input, 1, 1);
    expect(result).not.toBe(input);
    expect(result).toEqual(input);
  });

  it("preserves the same set of routine ids", () => {
    const input = makeAssignments(5);
    const result = reorderAssignments(input, 4, 0);
    const inputIds = input.map((a) => a.routineId).sort();
    const resultIds = result.map((a) => a.routineId).sort();
    expect(resultIds).toEqual(inputIds);
  });
});

describe("shiftDayForward", () => {
  it("moves assignments on the given day to the next day", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
      { id: "a-1", routineId: "r-1", dayIndex: 1, order: 0 },
    ];
    const result = shiftDayForward(input, 0);
    const day0 = result.filter((a) => a.dayIndex === 0);
    const day1 = result.filter((a) => a.dayIndex === 1);
    expect(day0).toHaveLength(0);
    expect(day1).toHaveLength(2);
    expect(day1.map((a) => a.routineId).sort()).toEqual(["r-0", "r-1"]);
  });

  it("wraps Sunday (6) to Monday (0)", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 6, order: 0 },
    ];
    const result = shiftDayForward(input, 6);
    expect(result[0].dayIndex).toBe(0);
  });

  it("does not mutate the input", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
    ];
    shiftDayForward(input, 0);
    expect(input[0].dayIndex).toBe(0);
  });

  it("preserves the same set of routine ids", () => {
    const input = makeAssignments(3, 0);
    input.push({ id: "a-2-day1", routineId: "r-9", dayIndex: 1, order: 0 });
    const result = shiftDayForward(input, 0);
    const inputIds = input.map((a) => a.routineId).sort();
    const resultIds = result.map((a) => a.routineId).sort();
    expect(resultIds).toEqual(inputIds);
  });
});

describe("skipDay", () => {
  it("removes all assignments on the given day", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
      { id: "a-1", routineId: "r-1", dayIndex: 1, order: 0 },
      { id: "a-2", routineId: "r-2", dayIndex: 0, order: 1 },
    ];
    const result = skipDay(input, 0);
    expect(result).toHaveLength(1);
    expect(result[0].routineId).toBe("r-1");
  });

  it("does not mutate the input", () => {
    const input = makeAssignments(3, 0);
    skipDay(input, 0);
    expect(input).toHaveLength(3);
  });
});

describe("assignToDay", () => {
  it("inserts a new assignment at the end of the day", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 1, order: 0 },
      { id: "a-1", routineId: "r-1", dayIndex: 0, order: 0 },
    ];
    const result = assignToDay(input, "r-new", 0);
    const day0 = result.filter((a) => a.dayIndex === 0);
    expect(day0).toHaveLength(2);
    expect(day0[1].routineId).toBe("r-new");
    expect(day0[1].order).toBe(1);
  });

  it("preserves existing assignments", () => {
    const input = makeAssignments(3, 0);
    const result = assignToDay(input, "r-new", 2);
    expect(result.filter((a) => a.dayIndex === 0)).toHaveLength(3);
    expect(result.filter((a) => a.dayIndex === 2)).toHaveLength(1);
  });
});

describe("moveAssignmentToDay", () => {
  it("moves a single assignment to another day", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
      { id: "a-1", routineId: "r-1", dayIndex: 1, order: 0 },
    ];
    const result = moveAssignmentToDay(input, "a-0", 1);
    expect(result[0].dayIndex).toBe(1);
    expect(result[0].routineId).toBe("r-0");
    expect(result.filter((a) => a.dayIndex === 0)).toHaveLength(0);
    expect(result.filter((a) => a.dayIndex === 1)).toHaveLength(2);
  });

  it("appends to the target day with the next order", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
      { id: "a-1", routineId: "r-1", dayIndex: 1, order: 0 },
      { id: "a-2", routineId: "r-2", dayIndex: 1, order: 1 },
    ];
    const result = moveAssignmentToDay(input, "a-0", 1);
    const day1 = result.filter((a) => a.dayIndex === 1).sort((a, b) => a.order - b.order);
    expect(day1[2].routineId).toBe("r-0");
    expect(day1[2].order).toBe(2);
  });

  it("does not mutate the input", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
    ];
    moveAssignmentToDay(input, "a-0", 1);
    expect(input[0].dayIndex).toBe(0);
  });

  it("preserves all other assignments unchanged", () => {
    const input: WeeklyAssignment[] = [
      { id: "a-0", routineId: "r-0", dayIndex: 0, order: 0 },
      { id: "a-1", routineId: "r-1", dayIndex: 1, order: 0 },
      { id: "a-2", routineId: "r-2", dayIndex: 2, order: 0 },
    ];
    const result = moveAssignmentToDay(input, "a-0", 2);
    expect(result[1]).toEqual(input[1]);
  });
});

describe("AssignmentHistory", () => {
  it("starts with the initial state", () => {
    const initial = makeAssignments(3);
    const history = new AssignmentHistory(initial);
    expect(history.current()).toEqual(initial);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it("push enables undo but not redo", () => {
    const history = new AssignmentHistory([]);
    history.push(makeAssignments(2));
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it("undo returns the previous state and enables redo", () => {
    const history = new AssignmentHistory([]);
    history.push(makeAssignments(2));
    history.push(makeAssignments(3));

    const before = history.current();
    const undone = history.undo();
    expect(undone).toHaveLength(2);
    expect(history.canRedo()).toBe(true);
    expect(undone).not.toEqual(before);
  });

  it("redo returns the future state and disables redo if empty", () => {
    const history = new AssignmentHistory([]);
    history.push(makeAssignments(2));
    history.undo();
    expect(history.canRedo()).toBe(true);
    const redone = history.redo();
    expect(redone).toHaveLength(2);
    expect(history.canRedo()).toBe(false);
  });

  it("push after undo clears the redo stack", () => {
    const history = new AssignmentHistory([]);
    history.push(makeAssignments(1));
    history.push(makeAssignments(2));
    history.undo();
    history.push(makeAssignments(3));
    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it("caps history at MAX_HISTORY pushes", () => {
    const history = new AssignmentHistory([]);
    for (let i = 0; i < 25; i++) {
      history.push([{ id: `a-${i}`, routineId: `r-${i}`, dayIndex: 0, order: 0 }]);
    }
    // undo all — only the last 20 should be available
    let undoCount = 0;
    while (history.canUndo()) {
      history.undo();
      undoCount++;
    }
    expect(undoCount).toBe(20);
  });

  it("undo on empty history returns null", () => {
    const history = new AssignmentHistory([]);
    expect(history.undo()).toBeNull();
  });

  it("redo on empty history returns null", () => {
    const history = new AssignmentHistory([]);
    expect(history.redo()).toBeNull();
  });

  it("never duplicates or loses routine ids across undo/redo", () => {
    const initial = makeAssignments(5);
    const history = new AssignmentHistory(initial);
    history.push(reorderAssignments(initial, 0, 2));
    history.push(reorderAssignments(reorderAssignments(initial, 0, 2), 1, 4));

    const snapshot = history.current();
    const ids = snapshot.map((a) => a.routineId).sort();

    history.undo();
    history.undo();
    history.redo();
    const after = history.current();
    const afterIds = after.map((a) => a.routineId).sort();

    expect(afterIds).toEqual(ids);
  });
});
