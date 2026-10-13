/**
 * routinesViewModel.ts — immutable weekly assignment model.
 *
 * The weekly planner works with a flat list of `WeeklyAssignment` records. Each
 * record maps a routine to a day of the week (0 = Monday … 6 = Sunday) and an
 * `order` that positions it within that day.
 *
 * All mutators return a new array and never mutate their input, so the React
 * component can use referential equality for change detection and the undo/redo
 * stack can store snapshots cheaply.
 */

export interface WeeklyAssignment {
  id: string;
  routineId: string;
  dayIndex: number;
  order: number;
}

const MAX_HISTORY = 20;

/**
 * Moves the assignment at index `from` to index `to` in a new array,
 * recomputing `order` for every element so it stays contiguous starting at 0.
 *
 * Pure: the input array is not mutated. Returns a shallow clone with the same
 * object when `from === to`.
 */
export function reorderAssignments(
  assignments: readonly WeeklyAssignment[],
  from: number,
  to: number,
): WeeklyAssignment[] {
  if (from === to) return assignments.map((a) => a);
  const result = [...assignments];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result.map((a, i) => ({ ...a, order: i }));
}

/**
 * Shifts every assignment on `dayIndex` to the next calendar day.
 * Sunday (6) wraps to Monday (0), starting a fresh week rather than dropping
 * the routine.
 */
export function shiftDayForward(
  assignments: readonly WeeklyAssignment[],
  dayIndex: number,
): WeeklyAssignment[] {
  const nextDay = (dayIndex + 1) % 7;
  return assignments.map((a) =>
    a.dayIndex === dayIndex ? { ...a, dayIndex: nextDay } : a,
  );
}

/**
 * Marks a day as rest by removing all assignments scheduled on that day.
 */
export function skipDay(
  assignments: readonly WeeklyAssignment[],
  dayIndex: number,
): WeeklyAssignment[] {
  return assignments.filter((a) => a.dayIndex !== dayIndex);
}

/**
 * Moves a single assignment to a different day, appending it to that day's queue
 * with the next available `order`.
 */
export function moveAssignmentToDay(
  assignments: readonly WeeklyAssignment[],
  assignmentId: string,
  targetDay: number,
): WeeklyAssignment[] {
  const dayAssignments = assignments.filter((a) => a.dayIndex === targetDay);
  const nextOrder = dayAssignments.length;
  return assignments.map((a) =>
    a.id === assignmentId ? { ...a, dayIndex: targetDay, order: nextOrder } : a,
  );
}

/**
 * Assigns a routine to a specific day, inserting it at the end of that day's
 * queue.
 */
export function assignToDay(
  assignments: readonly WeeklyAssignment[],
  routineId: string,
  dayIndex: number,
): WeeklyAssignment[] {
  const dayAssignments = assignments.filter((a) => a.dayIndex === dayIndex);
  const nextOrder = dayAssignments.length;
  const newAssignment: WeeklyAssignment = {
    id: `${routineId}-${Date.now()}`,
    routineId,
    dayIndex,
    order: nextOrder,
  };
  return [...assignments, newAssignment];
}

export interface AssignmentHistorySnapshot {
  past: WeeklyAssignment[][];
  present: WeeklyAssignment[];
  future: WeeklyAssignment[][];
}

export class AssignmentHistory {
  private past: WeeklyAssignment[][] = [];
  private present: WeeklyAssignment[];
  private future: WeeklyAssignment[][] = [];

  constructor(initial: WeeklyAssignment[] = []) {
    this.present = [...initial];
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Records a new state. Pushes the current state to `past` (capped at
   * MAX_HISTORY) and clears `future`.
   */
  push(next: readonly WeeklyAssignment[]): void {
    this.past.push(this.present);
    if (this.past.length > MAX_HISTORY) {
      this.past.shift();
    }
    this.present = next.map((a) => ({ ...a }));
    this.future = [];
  }

  undo(): WeeklyAssignment[] | null {
    if (this.past.length === 0) return null;
    this.future.unshift(this.present);
    this.present = this.past.pop()!.map((a) => ({ ...a }));
    return [...this.present];
  }

  redo(): WeeklyAssignment[] | null {
    if (this.future.length === 0) return null;
    this.past.push(this.present);
    this.present = this.future.shift()!.map((a) => ({ ...a }));
    return [...this.present];
  }

  current(): WeeklyAssignment[] {
    return this.present.map((a) => ({ ...a }));
  }

  /** Re-initialises the history with a new baseline, clearing everything. */
  reset(initial: readonly WeeklyAssignment[]): void {
    this.past = [];
    this.present = initial.map((a) => ({ ...a }));
    this.future = [];
  }
}

export type { AssignmentHistory as AssignmentHistoryClass };
