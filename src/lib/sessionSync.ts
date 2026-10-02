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

  // 1. Create or update the log under the client-generated id.
  const { error: logError } = await supabase.from("workout_logs").upsert(
    {
      id: payload.logId,
      user_id: payload.userId,
      routine_id: payload.routineId,
      started_at: payload.startedAt,
      completed_at: payload.completedAt,
      journal_notes: payload.notes,
    },
    { onConflict: "id" },
  );
  if (logError) throw new Error(logError.message);

  // 2. Replace the set rows wholesale. Partial retries are idempotent.
  const { error: deleteError } = await supabase
    .from("completed_sets")
    .delete()
    .eq("log_id", payload.logId);
  if (deleteError) throw new Error(deleteError.message);

  if (payload.sets.length > 0) {
    const rows = payload.sets.map((set) => ({ ...set, log_id: payload.logId }));
    const { error: insertError } = await supabase.from("completed_sets").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  // The rows now exist, so anything reading training history can refetch. Fired
  // last: announcing earlier would make consumers query before the data landed
  // and settle on stale numbers.
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

  for (const op of ops) {
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
      await updateQueueOp(updated);

      result.failed += 1;
      result.errors.push(message);

      // A permission or validation error will repeat forever; drop it and let
      // the app show the message instead of retrying on every online event.
      if (!retryable) {
        await removeFromQueue(op.id);
        result.errors.push(
          `Sesión ${op.payload.logId.slice(0, 8)} descartada: ${message}`,
        );
      }
      break;
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