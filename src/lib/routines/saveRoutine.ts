import { supabase } from "@lib/supabase";
import type { RoutineDraftV2 } from "./routineDayModel";
import { buildRoutineDescription } from "./routineMeta";
import { validateDraft } from "./routineDayModel";
import { createRoutineSaveQueue, type SaveJob, type SaveOrigin } from "./routineSaveQueue";

export type SaveResult =
  | { ok: true; routineId: string }
  | {
      ok: false;
      error: "validation" | "external_change" | "not_found" | "save_failed" | "verify_failed";
    };

type PendingSave = {
  resolve: (result: SaveResult) => void;
  reject: (err: unknown) => void;
};

const pendingSaves = new Map<string, PendingSave>();

function makeQueueKey(draft: RoutineDraftV2): string {
  return draft.id ?? crypto.randomUUID();
}

async function persistRoutine(job: SaveJob): Promise<boolean> {
  try {
    return await persistRoutineSafe(job);
  } catch {
    const pending = pendingSaves.get(job.draftKey);
    pending?.resolve({ ok: false, error: "save_failed" });
    pendingSaves.delete(job.draftKey);
    return false;
  }
}

async function persistRoutineSafe(job: SaveJob): Promise<boolean> {
  const { draft, routineId } = job;
  const problems = validateDraft(draft);
  if (problems.length > 0) {
    const pending = pendingSaves.get(job.draftKey);
    pending?.resolve({ ok: false, error: "validation" });
    pendingSaves.delete(job.draftKey);
    return false;
  }

  // checkNoExternalChange: para rutinas existentes, verificar que la descripción
  // en BD no haya cambiado desde que se cargó el snapshot.
  if (routineId !== null) {
    const { data: existing, error } = await supabase
      .from("routines")
      .select("description")
      .eq("id", routineId)
      .single();
    if (error || !existing) {
      const pending = pendingSaves.get(job.draftKey);
      pending?.resolve({ ok: false, error: "not_found" });
      pendingSaves.delete(job.draftKey);
      return false;
    }
    if (existing.description !== draft.description) {
      const pending = pendingSaves.get(job.draftKey);
      pending?.resolve({ ok: false, error: "external_change" });
      pendingSaves.delete(job.draftKey);
      return false;
    }
  }

  const targetId = routineId ?? crypto.randomUUID();
  const description = buildRoutineDescription(draft.description, {
    mode: draft.mode,
    days: draft.days.map((d) => ({
      id: d.id,
      order: d.order,
      weekday: d.weekday,
      label: d.label,
      kind: d.kind,
    })),
  });

  // Upsert de la rutina con .select("id").single()
  const { data: routineData, error: routineError } = await supabase
    .from("routines")
    .upsert(
      {
        id: targetId,
        user_id: draft.id !== null ? "" : "",
        title: draft.title,
        description,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (routineError || !routineData) {
    const pending = pendingSaves.get(job.draftKey);
    pending?.resolve({ ok: false, error: "save_failed" });
    pendingSaves.delete(job.draftKey);
    return false;
  }

  // Upsert de ejercicios por rowId (onConflict: "id")
  const rows = draft.days.flatMap((day, dayIndex) =>
    day.exercises.map((ex) => ({
      id: ex.rowId ?? crypto.randomUUID(),
      routine_id: targetId,
      exercise_id: ex.exercise.id,
      target_sets: ex.target_sets,
      rest_seconds: ex.rest_seconds,
      order_index: ex.order_index,
      day_index: dayIndex,
      day_label: day.label,
      target_reps_min: ex.target_reps_min,
      target_reps_max: ex.target_reps_max,
    })),
  );

  if (rows.length > 0) {
    const { error: exercisesError } = await supabase
      .from("routine_exercises")
      .upsert(rows, { onConflict: "id" });
    if (exercisesError) {
      const pending = pendingSaves.get(job.draftKey);
      pending?.resolve({ ok: false, error: "save_failed" });
      pendingSaves.delete(job.draftKey);
      return false;
    }
  }

  // Cleanup solo para rutinas existentes: borrar ejercicios que ya no están en el draft
  if (routineId !== null) {
    const keptRowIds = new Set(
      draft.days.flatMap((d) => d.exercises.map((e) => e.rowId).filter(Boolean)),
    );
    const { data: allExercises } = await supabase
      .from("routine_exercises")
      .select("id")
      .eq("routine_id", targetId);
    const toDelete = (allExercises ?? [])
      .filter((e) => e.id && !keptRowIds.has(e.id))
      .map((e) => e.id!);
    if (toDelete.length > 0) {
      await supabase.from("routine_exercises").delete().in("id", toDelete);
    }
  }

  // verifySave: leer de vuelta y verificar que los datos coincidan
  const { data: verifyData, error: verifyError } = await supabase
    .from("routines")
    .select("id, title, description")
    .eq("id", targetId)
    .single();

  const result: SaveResult =
    verifyError || !verifyData || verifyData.title !== draft.title
      ? { ok: false, error: "verify_failed" }
      : { ok: true, routineId: targetId };

  const pending = pendingSaves.get(job.draftKey);
  pending?.resolve(result);
  pendingSaves.delete(job.draftKey);
  return result.ok;
}

const queue = createRoutineSaveQueue(persistRoutine);

/**
 * Guarda un draft de rutina mediante la cola serial.
 * El resultado se resuelve cuando el processor termina.
 */
export function saveRoutine(
  draft: RoutineDraftV2,
  origin: SaveOrigin = "editor",
): Promise<SaveResult> {
  const key = makeQueueKey(draft);
  const job: SaveJob = {
    draftKey: key,
    routineId: draft.id,
    draft,
    generation: Date.now(),
    origin,
  };

  return new Promise<SaveResult>((resolve, reject) => {
    pendingSaves.set(key, { resolve, reject });
    queue.enqueue(job);
  });
}

/**
 * Fuerza el guardado inmediato de una clave pendiente.
 */
export function flushSave(key: string): Promise<boolean> {
  return queue.flush(key);
}

/**
 * Estado de guardado de una clave.
 */
export function saveState(key: string): "idle" | "saving" | "dirty" | "error" {
  return queue.state(key);
}

/**
 * Se suscribe a cambios de estado de una clave.
 */
export function subscribeSave(
  key: string,
  listener: (state: "idle" | "saving" | "dirty" | "error") => void,
): () => void {
  return queue.subscribe(key, listener);
}

/**
 * Duplica una rutina: crea un nuevo draft con id=null, nuevo título,
 * y copia los días y ejercicios sin rowId (se generarán al insertar).
 */
export function duplicateRoutine(draft: RoutineDraftV2, newTitle: string): RoutineDraftV2 {
  return {
    id: null,
    title: newTitle,
    description: "",
    mode: draft.mode,
    days: draft.days.map((day) => ({
      id: crypto.randomUUID(),
      order: day.order,
      weekday: day.weekday,
      label: day.label,
      kind: day.kind,
      exercises: day.exercises.map((ex) => ({
        exercise: ex.exercise,
        target_sets: ex.target_sets,
        rest_seconds: ex.rest_seconds,
        order_index: ex.order_index,
        target_reps_min: ex.target_reps_min,
        target_reps_max: ex.target_reps_max,
      })),
    })),
    snapshot: null,
    needsModeConfirmation: false,
  };
}

/**
 * Restaura una rutina existente como draft para editarla.
 */
export function restoreRoutine(
  routineId: string,
  title: string,
  description: string,
  mode: RoutineDraftV2["mode"],
  days: RoutineDraftV2["days"],
): RoutineDraftV2 {
  return {
    id: routineId,
    title,
    description,
    mode,
    days,
    snapshot: null,
    needsModeConfirmation: false,
  };
}
