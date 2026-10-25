/**
 * offlineStore.ts — local source of truth for an in-progress workout.
 *
 * Why IndexedDB and not localStorage: a session holds the full exercise
 * objects and every set row, which blows past the ~5 MB string quota of
 * localStorage once a few sessions accumulate. IndexedDB is async, so it
 * never blocks a tap handler.
 *
 * The session UUID is generated on the client and sent to Supabase with the
 * insert. Local and remote identifiers therefore match, which is what makes
 * the queue replayable: re-running an operation is a no-op instead of a
 * duplicate.
 *
 * Everything degrades to a no-op if IndexedDB is unavailable (private mode,
 * quota exhausted). Logging must never be the thing that breaks a workout.
 */

import type { Exercise } from "@/types/supabase";
import type { SetEntry } from "./workout/types";
import { normalizeSetEntry } from "./workout/setKind";
import { newInstanceId } from "./workout/instanceId";
import { DRAFT_STORE, QUEUE_STORE, openDb, tx } from "./idb";

export interface DraftExercise {
  key: string;
  exercise: Exercise;
  restSeconds: number;
  /**
   * The identity of this exercise within this session.
   *
   * The key is the catalog id and is shared by every session that runs the
   * exercise; this is the id of *this* execution of it, and it is what the
   * tracker follows from the first tap to the last. It travels with the draft
   * so that a reloaded session is still the same execution and not a new one.
   */
  instanceId?: string;
  /**
   * The superset this exercise belongs to, or null when it stands alone.
   *
   * Optional and nullable because both are real answers: a draft written
   * before supersets existed has no grouping to carry, and an exercise that
   * is not in a group says so with null rather than by being absent.
   */
  groupId?: string | null;
  /**
   * The sets of this exercise, each one carrying its own type.
   *
   * The type of a set -- `normal`, `warmup`, `failure` or `drop` -- travels in
   * `SetEntry.kind`, which is the single source of truth for it across the
   * whole app: the chip row renders it, the tonnage counts on it, and the
   * sync payload derives the database's warm-up flag from it. A second copy of
   * it on the draft would be a second answer to the same question, and the two
   * would disagree the first time a set was edited.
   *
   * A draft written before the kind chips shipped carries only the legacy
   * `is_warmup` flag; `normalizeSetEntry` maps that shape onto `kind` on read,
   * so the old draft is migrated rather than lost.
   */
  sets: SetEntry[];
}

/**
 * A full in-progress or just-finished session, persisted locally.
 *
 * v2 adds the two things a reload needs to put the athlete back exactly
 * where they were: the deadline of the rest that was running, and the
 * exercise that was on screen. Both are optional, because a draft written
 * before v2 is still a valid draft and has to keep working -- the
 * normaliser in `normalizeDraft` simply leaves them out.
 *
 * The type of each set does not live here either: it travels inside
 * `SetEntry.kind` -- `normal` | `warmup` | `failure` | `drop` -- which is the
 * single source of truth for it, and it is normalised on read by
 * `normalizeSetEntry`. A draft written before the kind chips shipped carries
 * `is_warmup: boolean` instead, and is mapped onto the current shape rather
 * than lost.
 */
export interface SessionDraft {
  /** Client-generated; also used as the Supabase `workout_logs.id`. */
  logId: string;
  userId: string;
  routineId: string | null;
  routineTitle: string;
  startedAt: string;
  items: DraftExercise[];
  notes: string;
  /** Set once the user finishes; still synced until the queue drains. */
  finalized: boolean;
  updatedAt: number;
  /**
   * When the rest that was running ends, in epoch milliseconds.
   *
   * A deadline rather than a remaining count, because a count is only true
   * at the moment it was written: the tab may be throttled, asleep or
   * closed, and a rest ends at a moment, not after a number of ticks. It is
   * the same reason the timer itself reads the wall clock.
   *
   * Absent when no rest was running.
   */
  restEndsAt?: number;
  /**
   * The exercise that was on screen, as the item key in `items`.
   *
   * Absent in a draft written before v2; `null` when there is no selection
   * to speak of.
   */
  selectedKey?: string | null;
}

/** One completed set, shaped to match the `completed_sets` columns. */
export interface QueuedSet {
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
  /**
   * What the athlete wrote about this set, or null.
   *
   * `20261003040000_exercise_hub_notes.sql`. Optional rather than required so a queue
   * written by an older build still replays: the column was added with no default, so an
   * omitted key and an explicit null are the same thing to PostgREST, and making this
   * required would only mean rewriting every payload already sitting on a device.
   *
   * Not on `SetEntry`. That shape is the live editing state of a form and its fields are
   * strings because a half-typed weight must survive; a note is optional free text that is
   * written once and never edited in place, so it enters at the persistence boundary
   * alongside `is_warmup`, which is derived the same way.
   */
  notes?: string | null;
}

export interface FinalizePayload {
  logId: string;
  /**
   * The user who created the session.
   *
   * The queue is device-wide, not user-scoped, so a different account signing
   * in on the same device must never be able to replay this operation.
   */
  userId: string;
  routineId: string | null;
  startedAt: string;
  completedAt: string;
  notes: string | null;
  sets: QueuedSet[];
}

export interface QueueOp {
  id: string;
  kind: "finalize_session";
  payload: FinalizePayload;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

// ---------------------------------------------------------------- IndexedDB
/*
 * The database name, version and upgrade handler live in `./idb`. This module used
 * to declare its own `DB_VERSION = 1` while `rankHistory` opened the same database
 * at v2, so whichever opened second got a `VersionError`, swallowed it, and
 * silently stopped queueing workouts. Owning the schema in one place is what
 * removes that class of bug; the degrade-to-`null` contract is unchanged and is now
 * `idb.ts`'s.
 */

// ---------------------------------------------------------------- drafts

export async function saveDraft(draft: SessionDraft): Promise<void> {
  await tx(DRAFT_STORE, "readwrite", (store) => store.put(draft));
}

/**
 * Repairs a draft written by an older build.
 *
 * Drafts are durable: a session opened before the set-kind chips shipped still
 * sits in IndexedDB with `is_warmup: boolean` and no `kind`, and it will be
 * offered back for recovery the next time the app opens. `normalizeSetEntry`
 * maps that shape onto the current one, including the legacy warm-up flag.
 *
 * The v2 fields are normalised rather than trusted. IndexedDB is durable, so
 * a value written by an older build -- or half-written by a session that died
 * mid-save -- has to survive the trip to the timer: a rest deadline that is
 * not a number is no rest at all, and a selection that is not a string is no
 * selection.
 */
function normalizeDraft(draft: SessionDraft): SessionDraft {
  return {
    ...draft,
    restEndsAt:
      typeof draft.restEndsAt === "number" && Number.isFinite(draft.restEndsAt)
        ? draft.restEndsAt
        : undefined,
    selectedKey: typeof draft.selectedKey === "string" ? draft.selectedKey : null,
    items: (draft.items ?? []).map((item) => ({
      ...item,
      sets: (item.sets ?? []).map((set, index) => normalizeSetEntry(set, index)),
    })),
  };
}

/** Loads a specific draft by session id. */
export async function loadDraft(logId: string): Promise<SessionDraft | null> {
  const draft = await tx<SessionDraft>(DRAFT_STORE, "readonly", (store) => store.get(logId));
  return draft ? normalizeDraft(draft) : null;
}

/**
 * Finds the newest unfinished draft for a user so a session survives a
 * reload, a crash or the tab being closed mid-workout.
 */
export async function loadRecoverableDraft(userId: string): Promise<SessionDraft | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise<SessionDraft | null>((resolve) => {
    try {
      const request = db.transaction(DRAFT_STORE, "readonly").objectStore(DRAFT_STORE).getAll();
      request.onsuccess = () => {
        const rows = (request.result ?? []) as unknown[];
        // Limpiar borradores zombis que ya fueron finalizados
        for (const row of rows) {
          if (row && typeof row === "object") {
            const r = row as Partial<SessionDraft>;
            if (r.userId === userId && r.finalized && typeof r.logId === "string") {
              void deleteDraft(r.logId);
            }
          }
        }
        const candidates: SessionDraft[] = [];
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          const r = row as Partial<SessionDraft>;
          if (r.userId !== userId) continue;
          if (r.finalized) continue;
          if (!Array.isArray(r.items) || r.items.length === 0) continue;
          if (typeof r.logId !== "string" || !r.logId) continue;
          if (typeof r.userId !== "string" || !r.userId) continue;
          try {
            const normalized = normalizeDraft(r as SessionDraft);
            if (normalized && Array.isArray(normalized.items) && normalized.items.length > 0) {
              candidates.push(normalized);
            }
          } catch {
            // skip corrupted draft
          }
        }
        candidates.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        resolve(candidates[0] ?? null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteDraft(logId: string): Promise<void> {
  await tx(DRAFT_STORE, "readwrite", (store) => store.delete(logId));
}

// ---------------------------------------------------------------- queue

export async function enqueueFinalize(payload: FinalizePayload): Promise<QueueOp | null> {
  const op: QueueOp = {
    // Deterministic per session so re-finishing replaces rather than
    // duplicating the queued operation.
    id: `finalize:${payload.logId}`,
    kind: "finalize_session",
    payload,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  await tx(QUEUE_STORE, "readwrite", (store) => store.put(op));
  return op;
}

/** All queued operations, oldest first. */
export async function listQueue(): Promise<QueueOp[]> {
  const rows = await tx<QueueOp[]>(QUEUE_STORE, "readonly", (store) => store.getAll());
  return (rows ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeFromQueue(id: string): Promise<void> {
  await tx(QUEUE_STORE, "readwrite", (store) => store.delete(id));
}

export async function updateQueueOp(op: QueueOp): Promise<void> {
  await tx(QUEUE_STORE, "readwrite", (store) => store.put(op));
}

export async function queueLength(): Promise<number> {
  const rows = await tx<QueueOp[]>(QUEUE_STORE, "readonly", (store) => store.getAll());
  return (rows ?? []).length;
}

// ---------------------------------------------------------------- ids

/**
 * Session UUID, generated locally so the identifier exists offline.
 *
 * The one implementation lives in `workout/instanceId`, because a session's
 * draft id and a session's execution ids are the same kind of thing: an
 * identity that exists before the server has heard of it.
 */
export function newSessionId(): string {
  return newInstanceId();
}