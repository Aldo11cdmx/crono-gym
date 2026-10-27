/**
 * sessionSync.ts — replays queued sessions against Supabase.
 *
 * The contract: finishing a workout must never depend on the network. The
 * session is written to IndexedDB and queued, the UI moves on immediately, and
 * this module reconciles whenever connectivity returns.
 *
 * Idempotency is what makes replay safe. A `finalize_session` operation:
 *   1. upserts `workout_logs` on the client-generated id
 *   2. deletes any existing sets for that log
 *   3. inserts the full set payload
 * Running it twice produces the same state as running it once, so a retry
 * after a partial failure can never double-count volume or PRs.
 */

import { supabase } from "@lib/supabase";
import { notifyTrainingDataChanged } from "./trainingEvents";
import {
  deleteDraft,
  enqueueFinalize,
  listQueue,
  removeFromQueue,
  updateQueueOp,
  type FinalizePayload,
  type QueueOp,
} from "./offlineStore";

export interface SyncResult {
  attempted: number;
  succeeded: number;
  failed: number;
  /** Messages worth surfacing, e.g. an RLS rejection that will never succeed. */
  errors: string[];
}

/** Network-shaped failures are worth retrying; others are not. */
function isRetryable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("failed to fetch") ||
    lower.includes("connection") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  );
}

/**
 * Writes one session. Safe to call repeatedly with the same payload.
 */
export async function pushSession(payload: FinalizePayload): Promise<void> {
  // Fail fast rather than let RLS reject it later: the queue outlives sign-out,
  // so the signed-in user may no longer be the session's owner.
  const { data: auth } = await supabase.auth.getUser();
  const signedIn = auth.user?.id ?? null;
  if (!signedIn) throw new Error("Sin sesión iniciada");
  if (signedIn !== payload.userId) {
    throw new Error("Esta sesión pertenece a otra cuenta");
  }

  // Validate required parameters before hitting the RPC: a 400 here means the
  // payload is malformed and retrying will never succeed.
  if (!payload.logId || typeof payload.logId !== "string") {
    throw new Error("logId requerido");
  }
  if (!payload.userId || typeof payload.userId !== "string") {
    throw new Error("userId requerido");
  }
  if (typeof payload.startedAt !== "string" || !payload.startedAt) {
    throw new Error("startedAt requerido");
  }
  if (typeof payload.completedAt !== "string" || !payload.completedAt) {
    throw new Error("completedAt requerido");
  }
  if (!Array.isArray(payload.sets)) {
    throw new Error("sets debe ser un arreglo");
  }

  const setsJson = payload.sets.map((set) => ({
    exercise_id: set.exercise_id,
    set_number: set.set_number,
    weight: set.weight === null ? null : set.weight,
    reps: set.reps === null ? null : set.reps,
    rpe: set.rpe === null ? null : set.rpe,
    is_warmup: set.is_warmup,
    notes: set.notes ?? null,
  }));

  const { error } = await (supabase as any).rpc("finalize_session", {
    p_log_id: payload.logId,
    p_user_id: payload.userId,
    p_routine_id: payload.routineId,
    p_name: payload.notes ?? null,
    p_started_at: payload.startedAt,
    p_ended_at: payload.completedAt,
    p_duration_seconds: null,
    p_notes: payload.notes,
    p_sets: setsJson,
  });

  if (error) throw new Error(error.message);

  notifyTrainingDataChanged();
}

/**
 * Drains the queue oldest-first.
 *
 * One operation at a time so a failure never interleaves with the next write,
 * and a non-retryable error stops the drain instead of hammering the API with
 * a payload that will always be rejected.
 */
export async function drainQueue(): Promise<SyncResult> {
  const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, errors: [] };
  const ops = await listQueue();

  // Skip operations permanently rejected by a non-retryable error: they stay
  // in the queue for manual review but are never retried automatically.
  const pending = ops.filter((op) => !op.permanentError);

  for (const op of pending) {
    result.attempted += 1;
    try {
      await pushSession(op.payload);
      await removeFromQueue(op.id);
      // The draft is only safe to drop once its data is remote.
      await deleteDraft(op.payload.logId);
      result.succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = isRetryable(message);

      const updated: QueueOp = {
        ...op,
        attempts: op.attempts + 1,
        lastError: message,
      };

      // A non-retryable error (RLS, schema, validation, permission) will never
      // succeed on retry. Mark it permanently and stop hammering the API.
      if (!retryable) {
        updated.permanentError = true;
        result.errors.push(
          `Sesión ${op.payload.logId.slice(0, 8)} pendiente de revisión: ${message} (se conserva en la cola)`,
        );
      } else {
        result.errors.push(message);
      }

      await updateQueueOp(updated);
      result.failed += 1;

      // Retryable errors: stop this pass, the interval will try again later.
      // Non-retryable errors: already marked permanent, just log and continue.
      if (retryable) {
        break;
      }
    }
  }

  return result;
}

/** Convenience wrapper: queue first, then try to drain if we are online. */
export async function queueAndSync(payload: FinalizePayload): Promise<SyncResult | null> {
  await enqueueFinalize(payload);
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return null;
  }
  try {
    return await drainQueue();
  } catch {
    return null;
  }
}