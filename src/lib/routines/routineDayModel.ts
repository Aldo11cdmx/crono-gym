import type { Exercise } from "@/types/supabase";

export type RoutineDayKind = "training" | "rest" | "mobility" | "empty";
export type RoutineMode = "single" | "weekly";

export interface DraftExercise {
  rowId?: string;
  exercise: Exercise;
  target_sets: number;
  rest_seconds: number;
  order_index: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  groupId?: string | null;
}

export interface RoutineDay {
  id: string;
  order: number;
  weekday: number | null;
  label: string;
  kind: RoutineDayKind;
  exercises: DraftExercise[];
}

export interface LoadedRoutineRow {
  rowId: string;
  exerciseId: string;
  dayIndex: number;
  orderIndex: number;
  targetSets: number;
  restSeconds: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
}

export interface LoadedRoutineSnapshot {
  title: string;
  description: string;
  rows: LoadedRoutineRow[];
}

export interface RoutineDraftV2 {
  id: string | null;
  title: string;
  description: string;
  mode: RoutineMode;
  days: RoutineDay[];
  snapshot: LoadedRoutineSnapshot | null;
  needsModeConfirmation?: boolean;
}

export function displayDayLabel(day: RoutineDay, mode: RoutineMode): string {
  const label = day.label.trim();
  if (label !== "") return day.label;
  if (day.kind === "training") {
    if (mode === "single") {
      return `Día ${String.fromCharCode(65 + (day.order % 26))}`;
    }
    const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    if (day.weekday !== null && day.weekday >= 0 && day.weekday <= 6) {
      return weekdays[day.weekday];
    }
    return "Día";
  }
  if (day.kind === "rest") return "Descanso";
  if (day.kind === "mobility") return "Movilidad";
  return "Sin sesión programada";
}

export function swapDayContents(
  days: RoutineDay[],
  fromWeekday: number,
  toWeekday: number,
): RoutineDay[] {
  const fromIdx = days.findIndex((d) => d.weekday === fromWeekday || d.order === fromWeekday);
  const toIdx = days.findIndex((d) => d.weekday === toWeekday || d.order === toWeekday);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return days;
  const next = [...days];
  const fromDay = next[fromIdx];
  const toDay = next[toIdx];
  next[fromIdx] = { ...fromDay, kind: toDay.kind, label: toDay.label, exercises: [...toDay.exercises] };
  next[toIdx] = { ...toDay, kind: fromDay.kind, label: fromDay.label, exercises: [...fromDay.exercises] };
  return next;
}

export function validateDraft(draft: RoutineDraftV2): string[] {
  const problems: string[] = [];
  if (draft.title.trim().length < 3) {
    problems.push(draft.title.trim() === "" ? "noTitle" : "titleTooShort");
  }
  if (draft.days.length === 0) problems.push("noExercises");
  if (draft.mode === "weekly" && draft.days.length !== 7) problems.push("weekdayConflict");
  const ids = new Set<string>();
  for (const day of draft.days) {
    if (ids.has(day.id)) problems.push("invalidDayId");
    ids.add(day.id);
    if (day.kind === "training" && day.exercises.length === 0) problems.push("dayWithoutExercises");
    if (day.kind !== "training" && day.exercises.length > 0) problems.push("dayWithoutExercises");
    const rowIds = new Set<string>();
    for (const ex of day.exercises) {
      if (ex.rowId) {
        if (rowIds.has(ex.rowId)) problems.push("duplicateRowId");
        rowIds.add(ex.rowId);
      }
    }
  }
  if (draft.mode === "weekly") {
    const weekdays = new Set<number>();
    for (const day of draft.days) {
      if (day.weekday === null) { problems.push("weekdayConflict"); continue; }
      if (weekdays.has(day.weekday)) problems.push("weekdayConflict");
      weekdays.add(day.weekday);
    }
    const trainingDays = draft.days.filter((d) => d.kind === "training");
    if (trainingDays.length === 0) problems.push("noTrainingDay");
  } else {
    const trainingDays = draft.days.filter((d) => d.kind === "training");
    if (trainingDays.length === 0) problems.push("noTrainingDay");
  }
  // duplicate exercise within a day
  for (const day of draft.days) {
    const exIds = new Set<string>();
    for (const ex of day.exercises) {
      if (exIds.has(ex.exercise.id)) problems.push("duplicateExerciseInDay");
      exIds.add(ex.exercise.id);
    }
  }
  if (draft.id !== null && draft.snapshot === null) problems.push("rowIdNotOwned");
  if (draft.days.length > 14 && draft.mode === "single") problems.push("tooManyDays");
  return problems;
}

export function newDraftKey(): string {
  return crypto.randomUUID();
}
