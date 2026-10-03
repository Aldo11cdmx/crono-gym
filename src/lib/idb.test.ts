/**
 * idb.test.ts
 *
 * The bug this file guards against is not a wrong number — it is two modules
 * declaring two different versions of the same database. `offlineStore` opened
 * `cronos-offline` at v1, `rankHistory` at v2, IndexedDB rejected the lower open with
 * a `VersionError`, and both swallowed it and resolved `null`. The workout queue
 * therefore stopped queueing, silently, depending on which module opened first.
 *
 * That failure cannot be reproduced without a real IndexedDB, and jsdom has none —
 * the convention already set by `rankHistory.test.ts` is to test the parts that are
 * this module's own. So the assertions here are on the schema table and on a static
 * check that nobody reintroduces a second owner, which is the actual regression
 * surface. The behaviour of IndexedDB itself is not this code's to test.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COACH_CHATS_STORE,
  DRAFT_STORE,
  DB_NAME,
  DB_VERSION,
  LAST_RANKS_STORE,
  QUEUE_STORE,
  RANK_HISTORY_STORE,
  STORES,
  openDb,
  resetDbForTests,
  tx,
} from "./idb";

const storeByName = (name: string) => STORES.find((s) => s.name === name);

describe("the cronos-offline schema", () => {
  it("keeps the name it has always had", () => {
    // Changing it would orphan every in-progress draft and the rank timeline of
    // every existing install, silently, with no migration to recover from.
    expect(DB_NAME).toBe("cronos-offline");
  });

  it("is at the version that includes every store", () => {
    expect(DB_VERSION).toBe(3);
  });

  it("declares every store exactly once", () => {
    // A duplicate name in the table would call `createObjectStore` twice for the
    // same store on a fresh install, which throws `ConstraintError` and aborts the
    // whole upgrade.
    const names = STORES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keys each store on the path its callers write", () => {
    // A wrong key path is silent for writes and only fails on read, as a record
    // that cannot be found. `drafts.logId` and `queue.id` are what the queue replay
    // and the draft loader depend on.
    expect(storeByName(DRAFT_STORE)?.keyPath).toBe("logId");
    expect(storeByName(QUEUE_STORE)?.keyPath).toBe("id");
    expect(storeByName(RANK_HISTORY_STORE)?.keyPath).toBe("id");
    expect(storeByName(LAST_RANKS_STORE)?.keyPath).toBe("slug");
    expect(storeByName(COACH_CHATS_STORE)?.keyPath).toBe("id");
  });

  it("declares the indexes the queries actually use", () => {
    // `loadRankHistoryFor` reads through a `slug` index and the queue drains in
    // `createdAt` order. An index missing here turns a cheap lookup into a full
    // scan, or throws outright if the query names one that was never created.
    expect(storeByName(RANK_HISTORY_STORE)?.indexes).toContain("slug");
    expect(storeByName(RANK_HISTORY_STORE)?.indexes).toContain("day");
    expect(storeByName(QUEUE_STORE)?.indexes).toContain("createdAt");
  });

  it("has no store without a key path", () => {
    for (const store of STORES) {
      expect(store.keyPath, store.name).toBeTruthy();
    }
  });
});

describe("openDb", () => {
  it("resolves null instead of throwing when IndexedDB is absent", async () => {
    // Node has no `indexedDB`, so this is the real production path for SSR and for
    // hardened browsers. The contract is a usable `null`, never an exception:
    // logging must not be the thing that breaks a workout.
    resetDbForTests();
    expect(typeof indexedDB).toBe("undefined");
    await expect(openDb()).resolves.toBeNull();
  });

  it("memoizes, so two callers share one connection", async () => {
    // Not just an optimization: two concurrent *upgrades* are illegal, and a
    // second open while one is in flight is how a blocked upgrade happens.
    resetDbForTests();
    const first = openDb();
    const second = openDb();
    expect(second).toBe(first);
    await first;
  });

  it("resolves null from a transaction rather than rejecting", async () => {
    // Every caller of `tx` does `await tx(...)` without a try/catch, so a rejection
    // here would surface as an unhandled rejection during a workout.
    resetDbForTests();
    const result = await tx(DRAFT_STORE, "readonly", (store) => store.get("nope"));
    expect(result).toBeNull();
  });
});

describe("single ownership of the database", () => {
  /**
   * Strips comments so the guard below reads code, not prose.
   *
   * Both files explain in a docblock exactly which version they used to declare and
   * what went wrong — which is the history worth keeping. Matching against the raw
   * source flagged those explanations as violations, so the check would either have
   * to be abandoned or the history deleted. Neither is acceptable.
   */
  function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  /**
   * The regression guard.
   *
   * Reads the modules that used to collide and asserts neither re-declares the
   * schema. This is a source check rather than a runtime one because the failure it
   * prevents cannot be triggered without a second connection and a version conflict,
   * which is exactly the situation that makes it slip through review.
   */
  const dependents = [
    ["offlineStore.ts", "./offlineStore.ts"],
    ["rankHistory.ts", "./ranks/rankHistory.ts"],
  ] as const;

  for (const [name, relative] of dependents) {
    it(`leaves the schema to idb.ts — ${name}`, () => {
      const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
      const code = codeOnly(source);

      // No local version constant: that is the thing that drifted.
      expect(code, `${name} must not declare DB_VERSION`).not.toMatch(/\bDB_VERSION\s*=/);
      // And it must not reach for the database directly either, or the upgrade
      // handler can be bypassed entirely.
      expect(code, `${name} must not call indexedDB.open`).not.toMatch(/indexedDB\s*\.\s*open/);
      expect(code, `${name} must not declare the database name`).not.toMatch(/cronos-offline/);
    });
  }

  it("keeps the history of the bug, so the guard has something to point at", () => {
    // The explanation is the reason the guard exists. A future refactor that deletes
    // the docblock has removed the context a reviewer needs to judge the check, so
    // its presence is itself worth asserting.
    const source = readFileSync(
      fileURLToPath(new URL("./ranks/rankHistory.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toMatch(/VersionError/);
  });
});