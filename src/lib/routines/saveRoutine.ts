import { supabase } from "@lib/supabase";
import type { RoutineDraftV2 } from "./routineDayModel";
import { buildRoutineDescription } from "./routineMeta";
import { newDraftKey } from "./routineDayModel";
import { validateDraft } from "./routineDayModel";
import { createRoutineSaveQueue, type SaveJob, type SaveOrigin } from "./routineSaveQueue";

export type SaveResult =
  | { ok: true; routineId: string }
  | {
      ok: false;
      error:
        | "validation"
        | "external_change"
        | "not_found"
        | "save_failed"
        | "verify_failed"
        | "rowIdNotOwned";
    };

type PendingSave = {
  resolve: (result: SaveResult) => void;
  reject: (err: unknown) => void;
  routineId?: string;
};

const pendingSaves = new Map<string, PendingSave>();

let nextGeneration = 0;
function nextGen(): number {
  nextGeneration += 1;
  return nextGeneration;
}

const draftRoutineIds = new Map<string, string>(); // draftKey -> routineId generado en el primer intento
const draftUserIds = new Map<string, string>(); // draftKey -> userId del guardado

function draftKeyOf(draft: RoutineDraftV2): string {
  return draft.draftKey;
}

async function persistRoutine(job: SaveJob): Promise<boolean> {
  const { draft, routineId } = job;
  const draftKey = draftKeyOf(draft);
  const userId = draftUserIds.get(draftKey);
  if (!userId) {
    const pending = pendingSaves.get(draftKey);
    pending?.resolve({ ok: false, error: "save_failed" });
    pendingSaves.delete(draftKey);
    return false;
  }
  const problems = validateDraft(draft);
  if (problems.length > 0) {
    const pending = pendingSaves.get(draftKey);
    pending?.resolve({ ok: false, error: "validation" });
    pendingSaves.delete(draftKey);
    return false;
  }

  // Resolver el targetId: nuevo (una sola vez) o el id existente de la rutina.
  let targetId: string;
  if (routineId !== null) {
    targetId = routineId;
  } else {
    const memorizado = draftRoutineIds.get(draftKey);
    if (memorizado) {
      targetId = memorizado;
    } else {
      targetId = crypto.randomUUID();
      draftRoutineIds.set(draftKey, targetId);
    }
    // Escribir el id generado en el draft antes de la llamada de red, para que
    // reintentos y UI lo vean.
    draft.id = targetId;
  }

  // checkNoExternalChange: para rutinas existentes, verificar que la descripción
  // cruda en BD coincida con el snapshot (la descripción tal como se cargó).
  if (routineId !== null) {
    const { data: existing, error } = await supabase
      .from("routines")
      .select("description")
      .eq("id", routineId)
      .single();
    if (error || !existing) {
      const pending = pendingSaves.get(draftKey);
      pending?.resolve({ ok: false, error: "not_found" });
      pendingSaves.delete(draftKey);
      return false;
    }
    const snapshotDesc = draft.snapshot?.description ?? null;
    if (existing.description !== snapshotDesc) {
      const pending = pendingSaves.get(draftKey);
      pending?.resolve({ ok: false, error: "external_change" });
      pendingSaves.delete(draftKey);
      return false;
    }
  }

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

  if (routineId !== null) {
    // Ruta de actualización: update (no upsert) para no reescribir user_id ni insertar filas nuevas.
    const { data: routineData, error: routineError } = await supabase
      .from("routines")
      .update({ title: draft.title, description })
      .eq("id", targetId)
      .select("id")
      .single();

    if (routineError || !routineData) {
      const pending = pendingSaves.get(draftKey);
      pending?.resolve({ ok: false, error: "not_found" });
      pendingSaves.delete(draftKey);
      return false;
    }
  } else {
    // Ruta de creación: upsert con user_id.
    const { data: routineData, error: routineError } = await supabase
      .from("routines")
      .upsert(
        {
          id: targetId,
          user_id: userId,
          title: draft.title,
          description,
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();

    if (routineError || !routineData) {
      const pending = pendingSaves.get(draftKey);
      pending?.resolve({ ok: false, error: "save_failed" });
      pendingSaves.delete(draftKey);
      return false;
    }
  }

  const allRowIds = draft.days
    .flatMap((d) => d.exercises)
    .map((e) => e.rowId)
    .filter((id): id is string => Boolean(id));

  // N4: verificar que cada rowId no nulo pertenezca a esta rutina (solo en actualización).
  // Para rutinas nuevas los rowId se crean ahora, no hay propiedad previa.
  if (routineId !== null && allRowIds.length > 0) {
    const { data: ownedRows, error: ownershipError } = await supabase
      .from("routine_exercises")
      .select("id, routine_id")
      .in("id", allRowIds);
    if (ownershipError) {
      const pending = pendingSaves.get(draftKey);
      pending?.resolve({ ok: false, error: "save_failed" });
      pendingSaves.delete(draftKey);
      return false;
    }
    const foreign = (ownedRows ?? []).filter((r) => r.routine_id !== targetId);
    if (foreign.length > 0) {
      const pending = pendingSaves.get(draftKey);
      pending?.resolve({ ok: false, error: "rowIdNotOwned" });
      pendingSaves.delete(draftKey);
      return false;
    }
  }

  // Upsert de ejercicios por rowId (onConflict: "id")
  const rows = draft.days.flatMap((day) =>
    day.exercises.map((ex) => ({
      id: ex.rowId!,
      routine_id: targetId,
      exercise_id: ex.exercise.id,
      target_sets: ex.target_sets,
      rest_seconds: ex.rest_seconds,
      order_index: ex.order_index,
      day_index: day.order,
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
      const pending = pendingSaves.get(draftKey);
      pending?.resolve({ ok: false, error: "save_failed" });
      pendingSaves.delete(draftKey);
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

  // verifySave: leer de vuelta y verificar título, descripción y filas de ejercicios.
  const { data: verifyData, error: verifyError } = await supabase
    .from("routines")
    .select("id, title, description")
    .eq("id", targetId)
    .single();

  const expectedExerciseRows = rows.map((r) => ({
    id: r.id,
    day_index: r.day_index,
    order_index: r.order_index,
    target_reps_min: r.target_reps_min,
    target_reps_max: r.target_reps_max,
  }));

  const { data: verifyRows, error: verifyRowsError } = await supabase
    .from("routine_exercises")
    .select("id, day_index, order_index, target_reps_min, target_reps_max")
    .eq("routine_id", targetId)
    .order("day_index")
    .order("order_index");

  const rowsMatch =
    verifyRows?.length === expectedExerciseRows.length &&
    verifyRows.every((r, i) => {
      const e = expectedExerciseRows[i];
      return (
        r.id === e.id &&
        r.day_index === e.day_index &&
        r.order_index === e.order_index &&
        r.target_reps_min === e.target_reps_min &&
        r.target_reps_max === e.target_reps_max
      );
    });

  const result: SaveResult =
    verifyError ||
    !verifyData ||
    verifyData.title !== draft.title ||
    verifyData.description !== description ||
    verifyRowsError ||
    !rowsMatch
      ? { ok: false, error: "verify_failed" }
      : { ok: true, routineId: targetId };

  const pending = pendingSaves.get(draftKey);
  pending?.resolve(result);
  pendingSaves.delete(draftKey);
  return result.ok;
}

const queue = createRoutineSaveQueue(persistRoutine);

export function saveRoutine(
  userId: string,
  draft: RoutineDraftV2,
  origin: SaveOrigin = "editor",
): Promise<SaveResult> {
  const draftKey = draftKeyOf(draft);
  draftUserIds.set(draftKey, userId);
  const job: SaveJob = {
    draftKey,
    routineId: draft.id,
    draft,
    generation: nextGen(),
    origin,
  };

  return new Promise<SaveResult>((resolve, reject) => {
    pendingSaves.set(draftKey, { resolve, reject });
    queue.enqueue(job);
  });
}

export function flushSave(key: string): Promise<boolean> {
  return queue.flush(key);
}

export function saveState(key: string): "idle" | "saving" | "dirty" | "error" {
  return queue.state(key);
}

export function subscribeSave(
  key: string,
  listener: (state: "idle" | "saving" | "dirty" | "error") => void,
): () => void {
  return queue.subscribe(key, listener);
}

export function duplicateRoutine(draft: RoutineDraftV2, newTitle: string): RoutineDraftV2 {
  return {
    draftKey: newDraftKey(),
    id: null,
    title: newTitle,
    description: draft.description,
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

export function restoreRoutine(
  routineId: string,
  title: string,
  description: string,
  mode: RoutineDraftV2["mode"],
  days: RoutineDraftV2["days"],
): RoutineDraftV2 {
  return {
    draftKey: newDraftKey(),
    id: routineId,
    title,
    description,
    mode,
    days,
    snapshot: null,
    needsModeConfirmation: false,
  };
}
