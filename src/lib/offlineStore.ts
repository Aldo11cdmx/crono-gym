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

const DB_NAME = "cronos-offline";
const DB_VERSION = 1;
const DRAFT_STORE = "drafts";
const QUEUE_STORE = "queue";

export interface DraftExercise {
  key: string;
  exercise: Exercise;
  restSeconds: number;
  sets: SetEntry[];
}

/** A full in-progress or just-finished session, persisted locally. */
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
}

/** One completed set, shaped to match the `completed_sets` columns. */
export interface QueuedSet {
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: boolean;
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

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    // Absent in SSR and in some hardened browsers.
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          // Keyed by logId so a single active session per device is enough.
          db.createObjectStore(DRAFT_STORE, { keyPath: "logId" });
        }
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt");
        }
      };

      request.onsuccess = () => resolve(request.result);
      // Private browsing and blocked storage land here; never throw at the user.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const transaction = db.transaction(store, mode);
          const request = run(transaction.objectStore(store));
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
          transaction.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

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
 */
function normalizeDraft(draft: SessionDraft): SessionDraft {
  return {
    ...draft,
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
        const rows = (request.result ?? []) as SessionDraft[];
        const candidate = rows
          .filter((d) => d.userId === userId && !d.finalized && d.items.length > 0)
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        resolve(candidate ? normalizeDraft(candidate) : null);
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
 * `crypto.randomUUID` needs a secure context; the fallback keeps the app
 * usable over plain http on a LAN.
 */
export function newSessionId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Version 4, variant 1.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}