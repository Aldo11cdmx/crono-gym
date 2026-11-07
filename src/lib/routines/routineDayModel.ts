import type { Exercise } from "@/types/supabase";
import { parseRoutineMeta, type RoutineMeta } from "./routineMeta";
import type { RoutineWithExercises } from "@/hooks/useGymData";

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
  draftKey: string;
  id: string | null;
  title: string;
  description: string;
  mode: RoutineMode;
  days: RoutineDay[];
  snapshot: LoadedRoutineSnapshot | null;
  needsModeConfirmation?: boolean;
  incomplete?: boolean;
}

export function displayDayLabel(day: RoutineDay, mode: RoutineMode): string {
  if (day.kind === "empty") return "Sin sesión programada";
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
  const rowIds = new Set<string>();
  for (const day of draft.days) {
    if (ids.has(day.id)) problems.push("invalidDayId");
    ids.add(day.id);
    if (day.kind === "training" && day.exercises.length === 0) problems.push("dayWithoutExercises");
    if (day.kind !== "training" && day.exercises.length > 0) problems.push("dayWithoutExercises");
    for (const ex of day.exercises) {
      if (!ex.rowId) problems.push("missingRowId");
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
  if (draft.id !== null && draft.snapshot === null) problems.push("missingSnapshot");
  if (draft.days.length > 14 && draft.mode === "single") problems.push("tooManyDays");
  return problems;
}

export function newDraftKey(): string {
  return crypto.randomUUID();
}

/**
 * Carga una rutina guardada (con sus ejercicios) en un RoutineDraftV2.
 *
 * Lee el sobre JSON de `description` y, si es válido y coherente con las filas,
 * reconstruye los días desde el sobre. Si el sobre es nulo o incoherente
 * (rutina legacy), reconstruye por `day_index` en modo single con
 * `needsModeConfirmation = true`. Nunca infiere weekly por el número de días.
 *
 * Captura siempre un snapshot con todas las filas tal como llegaron.
 */
export function draftFromRoutine(routine: RoutineWithExercises): RoutineDraftV2 {
  const { text, meta } = parseRoutineMeta(routine.description ?? "");

  const snapshot: LoadedRoutineSnapshot = {
    title: routine.title,
    description: routine.description ?? "",
    rows: routine.exercises.map((ex) => ({
      rowId: ex.rowId,
      exerciseId: ex.exercise.id,
      dayIndex: ex.dayIndex ?? 0,
      orderIndex: ex.order_index,
      targetSets: ex.target_sets,
      restSeconds: ex.rest_seconds,
      targetRepsMin: ex.target_reps_min,
      targetRepsMax: ex.target_reps_max,
    })),
  };

  let metaCoherent = false;
  if (meta) {
    const trainingDayOrders = new Set(
      meta.days.filter((d) => d.kind === "training").map((d) => d.order),
    );
    const rowDayIndices = new Set(routine.exercises.map((e) => e.dayIndex ?? 0));
    metaCoherent =
      trainingDayOrders.size === rowDayIndices.size &&
      [...trainingDayOrders].every((o) => rowDayIndices.has(o));
  }

  let metaToUse: RoutineMeta | null = null;
  if (meta && metaCoherent) {
    metaToUse = meta;
  } else if (meta && routine.exercises.length === 0 && meta.days.some((d) => d.kind === "training")) {
    metaToUse = meta;
  }

  const days: RoutineDay[] = [];
  let mode: RoutineMode = "single";
  let needsModeConfirmation = false;

  if (metaToUse) {
    mode = metaToUse.mode;
    for (const metaDay of metaToUse.days) {
      const dayRows = routine.exercises.filter(
        (e) => (e.dayIndex ?? 0) === metaDay.order,
      );
      days.push({
        id: metaDay.id,
        order: metaDay.order,
        weekday: metaDay.weekday,
        label: metaDay.label,
        kind: metaDay.kind,
        exercises: dayRows.map((ex, idx) => ({
          exercise: ex.exercise,
          target_sets: ex.target_sets,
          rest_seconds: ex.rest_seconds,
          order_index: idx,
          target_reps_min: ex.target_reps_min,
          target_reps_max: ex.target_reps_max,
          rowId: ex.rowId,
        })),
      });
    }
  } else {
    mode = "single";
    needsModeConfirmation = true;
    const byDay = new Map<number, (typeof routine.exercises)[number][]>();
    for (const ex of routine.exercises) {
      const di = ex.dayIndex ?? 0;
      const list = byDay.get(di) ?? [];
      list.push(ex);
      byDay.set(di, list);
    }
    const sortedDayIndices = [...byDay.keys()].sort((a, b) => a - b);
    let order = 0;
    for (const di of sortedDayIndices) {
      const exs = byDay.get(di) ?? [];
      let label = "";
      for (const ex of exs) {
        if (ex.dayLabel.trim() !== "") {
          label = ex.dayLabel;
          break;
        }
      }
      days.push({
        id: crypto.randomUUID(),
        order,
        weekday: null,
        label,
        kind: "training",
        exercises: exs.map((ex, idx) => ({
          exercise: ex.exercise,
          target_sets: ex.target_sets,
          rest_seconds: ex.rest_seconds,
          order_index: idx,
          target_reps_min: ex.target_reps_min,
          target_reps_max: ex.target_reps_max,
          rowId: ex.rowId,
        })),
      });
      order += 1;
    }
  }

  const incomplete =
    metaToUse !== null &&
    routine.exercises.length === 0 &&
    metaToUse.days.some((d) => d.kind === "training");

  return {
    draftKey: newDraftKey(),
    id: routine.id,
    title: routine.title,
    description: text,
    mode,
    days,
    snapshot,
    needsModeConfirmation,
    incomplete,
  };
}
