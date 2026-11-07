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

function completeSave(draftKey: string, result: SaveResult): void {
  draftRoutineIds.delete(draftKey);
  draftUserIds.delete(draftKey);
  const pending = pendingSaves.get(draftKey);
  pending?.resolve(result);
  pendingSaves.delete(draftKey);
}

async function persistRoutine(job: SaveJob): Promise<boolean> {
  const { draft, routineId } = job;
  const draftKey = draftKeyOf(draft);
  const userId = draftUserIds.get(draftKey);
  if (!userId) {
    completeSave(draftKey, { ok: false, error: "save_failed" });
    return false;
  }
  const problems = validateDraft(draft);
  if (problems.length > 0) {
    completeSave(draftKey, { ok: false, error: "validation" });
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
      completeSave(draftKey, { ok: false, error: "not_found" });
      return false;
    }
    const snapshotDesc = draft.snapshot?.description ?? null;
    if (existing.description !== snapshotDesc) {
      completeSave(draftKey, { ok: false, error: "external_change" });
      return false;
    }
  }

  // N4: verificar que cada rowId no nulo pertenezca a esta rutina (solo en actualización).
  // Va ANTES de cualquier escritura (update/upsert) para que un rowIdNotOwned no
  // deje la rutina sobrescrita y envenene reintentos posteriores.
  if (routineId !== null) {
    const allRowIds = draft.days
      .flatMap((d) => d.exercises)
      .map((e) => e.rowId)
      .filter((id): id is string => Boolean(id));
    if (allRowIds.length > 0) {
      const { data: ownedRows, error: ownershipError } = await supabase
        .from("routine_exercises")
        .select("id, routine_id")
        .in("id", allRowIds);
      if (ownershipError) {
        completeSave(draftKey, { ok: false, error: "save_failed" });
        return false;
      }
      const foreign = (ownedRows ?? []).filter((r) => r.routine_id !== targetId);
      if (foreign.length > 0) {
        completeSave(draftKey, { ok: false, error: "rowIdNotOwned" });
        return false;
      }
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
      completeSave(draftKey, { ok: false, error: "not_found" });
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
      completeSave(draftKey, { ok: false, error: "save_failed" });
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
      completeSave(draftKey, { ok: false, error: "save_failed" });
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

  // Index esperado por rowId (no por posición del array de días)
  const expectedByRowId = new Map<
    string,
    { day_index: number; order_index: number; target_reps_min: number | null; target_reps_max: number | null }
  >();
  for (const r of rows) {
    expectedByRowId.set(r.id, {
      day_index: r.day_index,
      order_index: r.order_index,
      target_reps_min: r.target_reps_min,
      target_reps_max: r.target_reps_max,
    });
  }

  const { data: verifyRows, error: verifyRowsError } = await supabase
    .from("routine_exercises")
    .select("id, day_index, order_index, target_reps_min, target_reps_max")
    .eq("routine_id", targetId)
    .order("day_index")
    .order("order_index");

  let rowsMatch = true;
  if (verifyRowsError || (verifyRows?.length ?? 0) !== expectedByRowId.size) {
    rowsMatch = false;
  } else {
    for (const r of verifyRows ?? []) {
      const expected = expectedByRowId.get(r.id);
      if (
        !expected ||
        expected.day_index !== r.day_index ||
        expected.order_index !== r.order_index ||
        expected.target_reps_min !== r.target_reps_min ||
        expected.target_reps_max !== r.target_reps_max
      ) {
        rowsMatch = false;
        break;
      }
    }
  }

  const result: SaveResult =
    verifyError ||
    !verifyData ||
    verifyData.title !== draft.title ||
    verifyData.description !== description ||
    verifyRowsError ||
    !rowsMatch
      ? { ok: false, error: "verify_failed" }
      : { ok: true, routineId: targetId };

  completeSave(draftKey, result);
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
    const existing = pendingSaves.get(draftKey);
    if (existing) {
      // Un guardado más nuevo reemplaza al pendiente para el mismo draftKey:
      // resolver la promesa anterior para que nunca quede colgada.
      existing.resolve({ ok: false, error: "save_failed" });
    }
    pendingSaves.set(draftKey, { resolve, reject });
    queue.enqueue(job);
  });
}

export function flushSave(key: string): Promise<boolean> {
  // Para rutinas nuevas el estado de la cola está bajo `draft:${draftKey}`;
  // probar ambas claves para que la UI solo necesite draft.draftKey.
  const direct = queue.flush(key);
  const prefixed = queue.flush(`draft:${key}`);
  return Promise.all([direct, prefixed]).then(([a, b]) => a || b);
}

export function saveState(key: string): "idle" | "saving" | "dirty" | "error" {
  const direct = queue.state(key);
  if (direct !== "idle") return direct;
  return queue.state(`draft:${key}`);
}

export function subscribeSave(
  key: string,
  listener: (state: "idle" | "saving" | "dirty" | "error") => void,
): () => void {
  const unsub1 = queue.subscribe(key, listener);
  const unsub2 = queue.subscribe(`draft:${key}`, listener);
  return () => {
    unsub1();
    unsub2();
  };
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
        rowId: crypto.randomUUID(),
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
