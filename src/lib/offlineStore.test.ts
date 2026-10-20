/**
 * offlineStore.test.ts — the draft, written and read back.
 *
 * The gap this file closes
 * ------------------------
 * `offlineStore` is the module that owns the athlete's unfinished session on
 * the device, and it had no test at all: `idb.test.ts` covers the schema
 * table, `ActiveWorkout.test.tsx` covers the *caller*, and between them
 * nothing checked that what `ActiveWorkout` hands to `saveDraft` is what
 * `loadRecoverableDraft` hands back. That is the whole promise of the draft,
 * and it is the promise that breaks silently -- a field that is written but
 * not read back is not an error, it is a session that comes back wrong.
 *
 * Why there is no IndexedDB here
 * ------------------------------
 * Neither Node nor jsdom ships one, and `fake-indexeddb` is not a dependency
 * of this project. `idb.test.ts` already established the convention: the
 * behaviour of IndexedDB itself is not this code's to test. So `./idb` is
 * replaced by an in-memory store that honours the same contract -- the same
 * key paths, the same asynchronous request, the same clone-on-write -- and
 * the module under test is the real one, doing real work.
 *
 * What is asserted here
 * ---------------------
 * The v2 fields of the draft -- the deadline of the rest that was running and
 * the exercise that was on screen -- and the type of every set, which travels
 * in `SetEntry.kind`. And the migration: a draft written by an older build is
 * opened and converted without losing a single series.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteDraft,
  loadDraft,
  loadRecoverableDraft,
  saveDraft,
  type SessionDraft,
} from "./offlineStore";
import type { Exercise } from "@/types/supabase";
import type { SetEntry } from "./workout/types";

/**
 * An in-memory stand-in for `./idb`.
 *
 * Hoisted above the imports so the mock factory can close over it: Vitest
 * lifts `vi.mock` above the module body, and a factory that referenced a
 * plain top-level `const` would run before that `const` was initialised.
 */
const fakeIdb = vi.hoisted(() => {
  /** The key each store is keyed on, mirroring the schema table in `idb.ts`. */
  const KEY_PATHS: Record<string, string> = { drafts: "logId", queue: "id" };

  const buckets = new Map<string, Map<string, unknown>>();

  function bucket(name: string): Map<string, unknown> {
    const existing = buckets.get(name);
    if (existing) return existing;
    const created = new Map<string, unknown>();
    buckets.set(name, created);
    return created;
  }

  interface FakeRequest {
    result: unknown;
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
  }

  /**
   * A request that answers asynchronously.
   *
   * The asynchrony is the point: a real `IDBRequest` fires its handler after
   * the caller has attached it, and a fake that resolved synchronously would
   * let `tx` resolve before the handler was wired up.
   */
  function request<T>(result: T): FakeRequest {
    const req: FakeRequest = { result, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  }

  function objectStore(name: string) {
    const keyPath = KEY_PATHS[name] ?? "id";
    return {
      put(value: Record<string, unknown>) {
        const key = String(value[keyPath]);
        // A clone, like the real thing: the stored row must not change when
        // the caller mutates the object it handed over.
        bucket(name).set(key, structuredClone(value));
        return request(key);
      },
      get(key: string) {
        return request(bucket(name).get(key));
      },
      getAll() {
        return request([...bucket(name).values()]);
      },
      delete(key: string) {
        bucket(name).delete(key);
        return request(undefined);
      },
    };
  }

  function tx(
    store: string,
    _mode: "readonly" | "readwrite",
    run: (store: ReturnType<typeof objectStore>) => FakeRequest,
  ): Promise<unknown> {
    return new Promise((resolve) => {
      try {
        const req = run(objectStore(store));
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  const db = {
    transaction() {
      return { objectStore: (store: string) => objectStore(store) };
    },
  };

  return {
    db,
    tx,
    reset() {
      buckets.clear();
    },
  };
});

vi.mock("./idb", () => ({
  DRAFT_STORE: "drafts",
  QUEUE_STORE: "queue",
  openDb: async () => fakeIdb.db,
  tx: fakeIdb.tx,
}));

const EXERCISE: Exercise = {
  id: "squat",
  name: "Sentadilla trasera",
  body_part: "upper legs",
  target: "quadriceps",
  equipment: "barbell",
  gif_url: "",
  instructions: [],
};

/** A draft as the workout writes it. */
function draft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  return {
    logId: "log-draft",
    userId: "user-1",
    routineId: "routine-1",
    routineTitle: "Fuerza",
    startedAt: "2026-10-20T08:00:00.000Z",
    items: [
      {
        key: "squat",
        exercise: { ...EXERCISE },
        restSeconds: 90,
        sets: [
          { set_number: 1, weight: "100", reps: "5", rpe: "8", kind: "normal", completed: true },
        ],
      },
    ],
    notes: "",
    finalized: false,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  fakeIdb.reset();
});

describe("the draft, written and read back", () => {
  it("comes back as it was written", async () => {
    const original = draft({ notes: "buena sesión" });
    await saveDraft(original);

    const loaded = await loadDraft("log-draft");

    expect(loaded?.logId).toBe("log-draft");
    expect(loaded?.notes).toBe("buena sesión");
    expect(loaded?.items[0]?.sets[0]?.weight).toBe("100");
  });

  it("does not share the object it was handed", async () => {
    // IndexedDB stores a clone. A draft that changed after the write would
    // mean the athlete's recovery offered a session that never existed.
    const original = draft();
    await saveDraft(original);
    original.items[0].sets[0].weight = "999";

    const loaded = await loadDraft("log-draft");
    expect(loaded?.items[0]?.sets[0]?.weight).toBe("100");
  });

  it("is found by the user it belongs to", async () => {
    await saveDraft(draft());
    expect((await loadRecoverableDraft("user-1"))?.logId).toBe("log-draft");
  });

  it("is not offered to somebody else", async () => {
    await saveDraft(draft());
    expect(await loadRecoverableDraft("user-2")).toBeNull();
  });

  it("is not offered once it is finished", async () => {
    await saveDraft(draft({ finalized: true }));
    expect(await loadRecoverableDraft("user-1")).toBeNull();
  });

  it("is not offered when it has no series", async () => {
    await saveDraft(draft({ items: [] }));
    expect(await loadRecoverableDraft("user-1")).toBeNull();
  });

  it("offers the newest of the drafts it holds", async () => {
    await saveDraft(draft({ logId: "log-old", updatedAt: 1 }));
    await saveDraft(draft({ logId: "log-new", updatedAt: 2 }));

    expect((await loadRecoverableDraft("user-1"))?.logId).toBe("log-new");
  });

  it("is gone once it is deleted", async () => {
    await saveDraft(draft());
    await deleteDraft("log-draft");

    expect(await loadDraft("log-draft")).toBeNull();
    expect(await loadRecoverableDraft("user-1")).toBeNull();
  });
});

describe("the deadline of the rest that was running", () => {
  it("survives the trip through storage", async () => {
    const endsAt = Date.now() + 45_000;
    await saveDraft(draft({ restEndsAt: endsAt }));

    // A deadline, not a count: the rest ends at a moment, and the moment is
    // the only thing a reload can still honour.
    expect((await loadRecoverableDraft("user-1"))?.restEndsAt).toBe(endsAt);
  });

  it("is absent when no rest was running", async () => {
    await saveDraft(draft());
    expect((await loadRecoverableDraft("user-1"))?.restEndsAt).toBeUndefined();
  });

  it("is dropped rather than trusted when it is not a number", async () => {
    // A draft written by a build that died mid-save can carry anything. A
    // deadline that is not a number is no rest at all, not a rest that ends
    // when the timer says so.
    await saveDraft(draft({ restEndsAt: "soon" as unknown as number }));

    expect((await loadRecoverableDraft("user-1"))?.restEndsAt).toBeUndefined();
  });
});

describe("the exercise that was on screen", () => {
  it("survives the trip through storage", async () => {
    await saveDraft(draft({ selectedKey: "squat" }));
    expect((await loadRecoverableDraft("user-1"))?.selectedKey).toBe("squat");
  });

  it("is null when the draft names no exercise", async () => {
    await saveDraft(draft({ selectedKey: null }));
    expect((await loadRecoverableDraft("user-1"))?.selectedKey).toBeNull();
  });

  it("is null rather than trusted when it is not a string", async () => {
    await saveDraft(draft({ selectedKey: 7 as unknown as string }));
    expect((await loadRecoverableDraft("user-1"))?.selectedKey).toBeNull();
  });
});

describe("the type of every set", () => {
  it("survives the trip through storage, one kind at a time", async () => {
    const sets: SetEntry[] = [
      { set_number: 1, weight: "60", reps: "10", rpe: "", kind: "warmup", completed: true },
      { set_number: 2, weight: "100", reps: "5", rpe: "8", kind: "drop", completed: true },
      { set_number: 3, weight: "100", reps: "5", rpe: "9", kind: "failure", completed: true },
      { set_number: 4, weight: "100", reps: "5", rpe: "", kind: "normal", completed: false },
    ];
    await saveDraft(
      draft({ items: [{ key: "squat", exercise: { ...EXERCISE }, restSeconds: 90, sets }] }),
    );

    // The kind is the difference between a warm-up and a drop set, and the
    // athlete's work only counts if it survives the trip through storage.
    const loaded = await loadRecoverableDraft("user-1");
    expect(loaded?.items[0]?.sets.map((s) => s.kind)).toEqual([
      "warmup",
      "drop",
      "failure",
      "normal",
    ]);
  });

  it("is migrated from the legacy warm-up flag", async () => {
    // A draft written before the kind chips shipped carries `is_warmup` and
    // no `kind`. It is still a valid draft, and it has to open.
    const legacy = {
      set_number: 1,
      weight: "60",
      reps: "10",
      rpe: "",
      is_warmup: true,
      completed: true,
    } as unknown as SetEntry;

    await saveDraft(
      draft({
        items: [{ key: "squat", exercise: { ...EXERCISE }, restSeconds: 90, sets: [legacy] }],
      }),
    );

    const loaded = await loadRecoverableDraft("user-1");
    expect(loaded?.items[0]?.sets[0]?.kind).toBe("warmup");
    expect(loaded?.items[0]?.sets[0]).not.toHaveProperty("is_warmup");
  });

  it("falls back to a working set when the type is unknown", async () => {
    const broken = {
      set_number: 1,
      weight: "60",
      reps: "10",
      rpe: "",
      kind: "superset",
      completed: true,
    } as unknown as SetEntry;

    await saveDraft(
      draft({
        items: [{ key: "squat", exercise: { ...EXERCISE }, restSeconds: 90, sets: [broken] }],
      }),
    );

    // An unknown kind is not trusted: a row that claims to be something the
    // app does not know about is counted as the ordinary set it probably is.
    expect((await loadRecoverableDraft("user-1"))?.items[0]?.sets[0]?.kind).toBe("normal");
  });
});

describe("a draft written before v2", () => {
  it("opens without losing a single series", async () => {
    const legacy = {
      set_number: 1,
      weight: "60",
      reps: "10",
      rpe: "",
      is_warmup: true,
      completed: true,
      notes: "la rodilla protestó",
    } as unknown as SetEntry;

    await saveDraft({
      logId: "log-v1",
      userId: "user-1",
      routineId: null,
      routineTitle: "Sesión libre",
      startedAt: "2026-10-19T07:00:00.000Z",
      items: [
        { key: "squat", exercise: { ...EXERCISE }, restSeconds: 90, sets: [legacy] },
      ] as SessionDraft["items"],
      notes: "",
      finalized: false,
      updatedAt: 1,
    });

    const loaded = await loadRecoverableDraft("user-1");
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0]?.sets).toHaveLength(1);
    // The note is prose about one attempt at one weight, and it belongs to
    // the set it was written on.
    expect(loaded?.items[0]?.sets[0]?.notes).toBe("la rodilla protestó");
    // And the v2 fields are simply absent, rather than wrong.
    expect(loaded?.restEndsAt).toBeUndefined();
    expect(loaded?.selectedKey).toBeNull();
  });
});
