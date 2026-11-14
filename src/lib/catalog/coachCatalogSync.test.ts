// @vitest-environment jsdom
/**
 * The two tiers, and what each one does when the other is unavailable.
 *
 * Tier 1 is the point of the module: the coach sees the change in the frame it
 * was made. Tier 2 is the reason the change survives a cache clear -- and the
 * 42703 fallback is the reason a rename still lands before the migration runs.
 *
 * Tier 2 is also the only thing allowed to say "saved everywhere": a write that
 * matches no row is reported as local, because Supabase did not confirm it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogExercise } from "./types";
import {
  CATALOG_OVERRIDES_KEY,
  EXERCISE_NAME_OVERRIDES_KEY,
  invalidateOverridesSnapshot,
  readOverridesSnapshot,
} from "./customExercises";
import { resetCatalogRegistry, setLoadedCatalog } from "./catalogRegistry";
import {
  COACH_GIF_BUCKET,
  MAX_GIF_BYTES,
  countPendingOverrides,
  deleteCoachExercise,
  hydrateOverridesFromSupabase,
  isUndefinedColumn,
  persistCoachExerciseChange,
  restoreCoachExercise,
  syncPendingOverrides,
  uploadOrResolveCoachGif,
} from "./coachCatalogSync";
import {
  countDeletedExercises,
  filterDeletedExercises,
  isExerciseDeleted,
} from "./customExercises";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  listError: null as null | { code?: string; message?: string },
  updateError: null as null | { code?: string; message?: string },
  uploadError: null as null | { message: string },
  /** How many writes fail before the mock starts succeeding. */
  updateFailsLeft: 0,
  selectFailsLeft: 0,
  /** The ids the server says it touched. Empty means "no row matched". */
  writtenIds: ["0001"] as string[],
  updates: [] as Record<string, unknown>[],
  updateFilters: [] as string[][],
  selects: [] as string[],
  uploads: [] as { path: string; size: number }[],
  online: true,
}));

vi.mock("@lib/supabase", () => {
  const query = () => {
    const builder: Record<string, unknown> = {
      select(columns: string) {
        state.selects.push(columns);
        return builder;
      },
      limit() {
        const error = state.selectFailsLeft > 0 ? state.listError : null;
        if (state.selectFailsLeft > 0) state.selectFailsLeft -= 1;
        return Promise.resolve({ data: state.rows, error });
      },
      update(payload: Record<string, unknown>) {
        state.updates.push(payload);
        return builder;
      },
      in(_column: string, values: string[]) {
        state.updateFilters.push(values);
        const error = state.updateFailsLeft > 0 ? state.updateError : null;
        if (state.updateFailsLeft > 0) state.updateFailsLeft -= 1;
        return {
          select: () => Promise.resolve({ data: error ? null : state.writtenIds, error }),
        };
      },
    };
    return builder;
  };

  return {
    supabase: {
      from: () => query(),
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, file: File) => {
            state.uploads.push({ path, size: file.size });
            return { error: state.uploadError };
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://cdn.example/${bucket}/${path}` },
          }),
        }),
      },
    },
  };
});

function row(overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id: "0001",
    name: "Push-up",
    name_es: null,
    category: "strength",
    body_part: "chest",
    equipment: "body weight",
    gif_url: "https://cdn.example/shipped.gif",
    image: "https://cdn.example/shipped.jpg",
    muscle_group: "chest",
    secondary_muscles: [],
    target: "pectorals",
    availableInCronosGym: true,
    equipment_id: "NONE",
    instructions: {},
    instruction_steps: {},
    media_id: "0001",
    created_at: "2026-01-01T00:00:00.000Z",
    attribution: null,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  invalidateOverridesSnapshot();
  resetCatalogRegistry();
  setLoadedCatalog([row()]);
  state.rows = [];
  state.listError = null;
  state.updateError = null;
  state.uploadError = null;
  state.updateFailsLeft = 0;
  state.selectFailsLeft = 0;
  state.writtenIds = ["0001"];
  state.updates = [];
  state.updateFilters = [];
  state.selects = [];
  state.uploads = [];
  state.online = true;
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => state.online });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("persistCoachExerciseChange", () => {
  it("writes the override locally and updates the row remotely", async () => {
    const result = await persistCoachExerciseChange("0001", {
      equipment_id: "CG-EQP-0012",
      station_key: "flat_bench",
      availableInCronosGym: false,
    });

    expect(result).toEqual({ local: true, remote: "updated" });
    expect(readOverridesSnapshot().catalog["0001"]).toMatchObject({
      equipment_id: "CG-EQP-0012",
      station_key: "flat_bench",
      availableInCronosGym: false,
      syncStatus: "synced",
      dirty: false,
    });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({
      equipment_id: "CG-EQP-0012",
      station_key: "flat_bench",
      available_in_cronos_gym: false,
      // `equipment` is not nullable, so a machine is stored as "id::name".
      equipment: expect.stringMatching(/^CG-EQP-0012::/),
    });
    // The change is only "synced" once the server said which rows it touched.
    expect(state.updateFilters[0]).toEqual(["0001", "1"]);
  });

  it("targets both id forms, so a row stored as 1 is still written", async () => {
    await persistCoachExerciseChange("1", { gif_url: "https://cdn.example/new.gif" });

    expect(state.updateFilters[0]).toEqual(["0001", "1"]);
    // And the override is readable under either key.
    expect(readOverridesSnapshot().catalog["1"]).toBeDefined();
  });

  it("marks an exercise with no machine as body weight in the text column", async () => {
    await persistCoachExerciseChange("0001", { equipment_id: "NONE" });

    expect(state.updates[0]).toMatchObject({
      equipment_id: "NONE",
      equipment: "body weight",
    });
  });

  it("announces the change, so open screens re-resolve", async () => {
    const listener = vi.fn();
    window.addEventListener("cronos:catalog-updated", listener);
    await persistCoachExerciseChange("0001", { gif_url: "https://cdn.example/new.gif" });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("cronos:catalog-updated", listener);
  });

  it("falls back to the base columns when the server has not been migrated", async () => {
    state.updateError = { code: "42703", message: "column equipment_id does not exist" };
    state.updateFailsLeft = 1;

    const result = await persistCoachExerciseChange(
      "0001",
      { equipment_id: "CG-EQP-0012", customNameEs: "Press banca" },
      row(),
    );

    expect(result.remote).toBe("updated");
    expect(state.updates).toHaveLength(2);
    expect(state.updates[1]).toEqual({ name: "Press banca" });
    expect(state.updates[1]).not.toHaveProperty("equipment_id");
    // The rename is still on the device, so the app shows it without the server.
    expect(readOverridesSnapshot().catalog["0001"].customNameEs).toBeUndefined();
    expect(JSON.parse(window.localStorage.getItem(EXERCISE_NAME_OVERRIDES_KEY) ?? "{}")["0001"]).toBe(
      "Press banca",
    );
  });

  it("keeps the change local when Supabase confirms no row", async () => {
    state.writtenIds = [];

    const result = await persistCoachExerciseChange("9999", { availableInCronosGym: false });

    expect(result.remote).toBe("unavailable");
    expect(result.detail).toEqual(expect.stringContaining("Supabase"));
    // The coach still sees it, but the row says the work is not everywhere.
    expect(readOverridesSnapshot().catalog["9999"]).toMatchObject({
      availableInCronosGym: false,
      syncStatus: "local_only",
      dirty: true,
    });
    expect(countPendingOverrides()).toBe(1);
  });

  it("keeps the change local when the device is offline, and writes nothing remote", async () => {
    state.online = false;

    const result = await persistCoachExerciseChange("0001", { equipment_id: "CG-EQP-0012" });

    expect(result).toEqual({ local: true, remote: "offline" });
    expect(state.updates).toHaveLength(0);
    expect(readOverridesSnapshot().catalog["0001"].equipment_id).toBe("CG-EQP-0012");
    expect(readOverridesSnapshot().catalog["0001"].syncStatus).toBe("pending");
  });

  it("reports a refusal instead of throwing", async () => {
    state.updateError = { code: "42501", message: "new row violates row-level security" };
    state.updateFailsLeft = 1;

    const result = await persistCoachExerciseChange("0001", { equipment_id: "CG-EQP-0012" });

    expect(result.remote).toBe("unavailable");
    expect(result.detail).toEqual(expect.any(String));
    expect(readOverridesSnapshot().catalog["0001"].equipment_id).toBe("CG-EQP-0012");
    expect(readOverridesSnapshot().catalog["0001"].syncStatus).toBe("local_only");
  });

  it("recognises the undefined-column error by code or by message", () => {
    expect(isUndefinedColumn({ code: "42703" })).toBe(true);
    expect(isUndefinedColumn({ message: 'column "station_key" does not exist' })).toBe(true);
    expect(isUndefinedColumn({ code: "PGRST204" })).toBe(true);
    expect(isUndefinedColumn({ code: "42501" })).toBe(false);
  });
});

describe("syncPendingOverrides", () => {
  it("sends what the device owes and reports how much is left", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({
        "0001": { equipment_id: "CG-EQP-0012", dirty: true, syncStatus: "pending" },
        "0002": { gif_url: "https://cdn.example/new.gif", syncStatus: "synced", dirty: false },
      }),
    );
    invalidateOverridesSnapshot();

    const result = await syncPendingOverrides();

    expect(result.attempted).toBe(1);
    expect(result.synced).toBe(1);
    expect(result.stillPending).toBe(0);
    expect(readOverridesSnapshot().catalog["0001"].syncStatus).toBe("synced");
    // The row that was already synced is not written again.
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ equipment_id: "CG-EQP-0012" });
  });
});

describe("hydrateOverridesFromSupabase", () => {
  it("takes the remote governance into the local store, once", async () => {
    state.rows = [
      { id: "0001", name: "Push-up", equipment: "body weight", gif_url: "https://cdn.example/shipped.gif", equipment_id: "CG-EQP-0012", station_key: "flat_bench", available_in_cronos_gym: false },
      { id: "0002", name: "Pull-up", equipment: "body weight", gif_url: "https://cdn.example/coach.gif", available_in_cronos_gym: true },
    ];
    setLoadedCatalog([row(), row({ id: "0002", name: "Pull-up", gif_url: "https://cdn.example/shipped-2.gif" })]);
    const listener = vi.fn();
    window.addEventListener("cronos:catalog-updated", listener);

    const result = await hydrateOverridesFromSupabase();
    window.removeEventListener("cronos:catalog-updated", listener);

    expect(result.remote).toBe("full");
    expect(result.hydrated).toBe(2);
    // One announcement for the page, not one per row.
    expect(listener).toHaveBeenCalledTimes(1);

    const snapshot = readOverridesSnapshot();
    expect(snapshot.catalog["0001"]).toMatchObject({
      equipment_id: "CG-EQP-0012",
      station_key: "flat_bench",
      availableInCronosGym: false,
    });
    // A GIF that differs from the shipped one is a coach's choice; one that
    // matches is just the shipped file, and stays unpinned.
    expect(snapshot.catalog["0002"].gif_url).toBe("https://cdn.example/coach.gif");
    expect(snapshot.catalog["0001"].gif_url).toBeUndefined();
  });

  it("falls back to the base columns on a server without the migration", async () => {
    state.listError = { code: "42703", message: "column equipment_id does not exist" };
    state.selectFailsLeft = 1;
    state.rows = [{ id: "0001", name: "Push-up", equipment: "body weight", gif_url: "https://cdn.example/shipped.gif" }];

    const result = await hydrateOverridesFromSupabase();

    expect(result.remote).toBe("base");
    expect(state.selects[1]).not.toContain("equipment_id");
    expect(result.hydrated).toBe(0);
  });

  it("does not clear what the device already holds when the read fails", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({ "0001": { equipment_id: "CG-EQP-0003" } }),
    );
    invalidateOverridesSnapshot();
    state.listError = { code: "42501", message: "permission denied" };
    state.selectFailsLeft = 1;

    const result = await hydrateOverridesFromSupabase();

    expect(result.remote).toBe("unavailable");
    expect(readOverridesSnapshot().catalog["0001"].equipment_id).toBe("CG-EQP-0003");
  });

  /**
   * The reload regression: a change the device made but could not upload must not
   * be replaced by the row the server still holds.
   */
  it("keeps a local change when the remote row still holds the shipped value", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({
        "0001": {
          customNameEs: "Press banca",
          equipment_id: "NONE",
          station_key: "floor_mat_area",
          gif_url: "https://cdn.example/coach.gif",
          dirty: true,
          syncStatus: "pending",
        },
      }),
    );
    window.localStorage.setItem(
      EXERCISE_NAME_OVERRIDES_KEY,
      JSON.stringify({ "0001": "Press banca" }),
    );
    invalidateOverridesSnapshot();
    state.rows = [
      {
        id: "0001",
        name: "Push-up",
        equipment: "body weight",
        gif_url: "https://cdn.example/shipped.gif",
        equipment_id: "CG-EQP-0040",
        station_key: "decline_bench",
      },
    ];

    const result = await hydrateOverridesFromSupabase();

    expect(result.hydrated).toBe(0);
    const snapshot = readOverridesSnapshot();
    expect(snapshot.catalog["0001"]).toMatchObject({
      customNameEs: "Press banca",
      equipment_id: "NONE",
      station_key: "floor_mat_area",
      gif_url: "https://cdn.example/coach.gif",
      dirty: true,
    });
    expect(snapshot.names["0001"]).toBe("Press banca");
  });

  it("adopts a remote field the device never touched, and keeps the rest pending", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({
        "0001": { customNameEs: "Press banca", dirty: true, syncStatus: "pending" },
      }),
    );
    invalidateOverridesSnapshot();
    state.rows = [
      {
        id: "0001",
        name: "Push-up",
        equipment: "body weight",
        gif_url: "https://cdn.example/shipped.gif",
        equipment_id: "CG-EQP-0007",
      },
    ];

    await hydrateOverridesFromSupabase();

    const snapshot = readOverridesSnapshot();
    // The machine the device never touched comes from the server...
    expect(snapshot.catalog["0001"].equipment_id).toBe("CG-EQP-0007");
    // ...while the rename it has not uploaded stays exactly as it was.
    expect(snapshot.catalog["0001"].customNameEs).toBe("Press banca");
    expect(snapshot.catalog["0001"].syncStatus).toBe("pending");
  });

  it("adopts a row the server marks as removed, so it does not come back", async () => {
    state.rows = [
      { id: "0001", name: "Push-up", equipment: "DELETED", gif_url: "https://cdn.example/shipped.gif" },
      { id: "0002", name: "Pull-up", equipment: "body weight", gif_url: "https://cdn.example/shipped-2.gif" },
    ];
    setLoadedCatalog([row(), row({ id: "0002", name: "Pull-up", gif_url: "https://cdn.example/shipped-2.gif" })]);

    const result = await hydrateOverridesFromSupabase();

    expect(result.hydrated).toBe(1);
    const snapshot = readOverridesSnapshot();
    expect(snapshot.catalog["0001"]).toMatchObject({ deleted: true, availableInCronosGym: false });
    expect(snapshot.catalog["0002"]?.deleted).toBeUndefined();
    expect(isExerciseDeleted("0001")).toBe(true);
    expect(isExerciseDeleted("0002")).toBe(false);
  });

  it("does not resurrect a removal this device has not uploaded", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({ "0001": { deleted: true, dirty: true, syncStatus: "pending" } }),
    );
    invalidateOverridesSnapshot();
    state.rows = [
      { id: "0001", name: "Push-up", equipment: "body weight", gif_url: "https://cdn.example/shipped.gif" },
    ];

    await hydrateOverridesFromSupabase();

    expect(readOverridesSnapshot().catalog["0001"]).toMatchObject({
      deleted: true,
      dirty: true,
      syncStatus: "pending",
    });
  });

  it("says offline rather than reporting an empty catalog", async () => {
    state.online = false;
    const result = await hydrateOverridesFromSupabase();
    expect(result).toEqual({ hydrated: 0, remote: "unavailable", detail: "offline" });
  });
});

describe("deleteCoachExercise", () => {
  it("marks the row on the server and hides it on the device in the same call", async () => {
    const listener = vi.fn();
    window.addEventListener("cronos:catalog-updated", listener);

    const result = await deleteCoachExercise("0001");
    window.removeEventListener("cronos:catalog-updated", listener);

    expect(result).toEqual({ local: true, remote: "marked_deleted" });
    // The coach's screen loses the exercise before the request is answered.
    expect(readOverridesSnapshot().catalog["0001"]).toMatchObject({
      deleted: true,
      availableInCronosGym: false,
      syncStatus: "synced",
      dirty: false,
    });
    expect(filterDeletedExercises([row(), row({ id: "0002" })]).map((r) => r.id)).toEqual(["0002"]);
    expect(countDeletedExercises()).toBe(1);
    // The removal is a mark, not a purge: a routine that references the row keeps
    // its history, and the same column is what tells other devices to hide it.
    expect(state.updates[0]).toEqual({
      available_in_cronos_gym: false,
      equipment: "DELETED",
    });
    expect(state.updateFilters[0]).toEqual(["0001", "1"]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.objectContaining({ exerciseId: "0001", deleted: true }) }),
    );
  });

  it("falls back to the free-text column on a server without the migration", async () => {
    state.updateError = { code: "42703", message: "column available_in_cronos_gym does not exist" };
    state.updateFailsLeft = 1;

    const result = await deleteCoachExercise("0001");

    expect(result.remote).toBe("marked_deleted");
    expect(state.updates).toHaveLength(2);
    expect(state.updates[1]).toEqual({ equipment: "DELETED" });
  });

  it("stays on the device when the exercise is not in the server table", async () => {
    state.writtenIds = [];

    const result = await deleteCoachExercise("0001");

    expect(result.remote).toBe("unavailable");
    expect(result.detail).toEqual(expect.stringContaining("dispositivo"));
    expect(readOverridesSnapshot().catalog["0001"]).toMatchObject({
      deleted: true,
      syncStatus: "local_only",
      dirty: true,
    });
    expect(isExerciseDeleted("0001")).toBe(true);
    expect(countPendingOverrides()).toBe(1);
  });

  it("does not write anything remote while the gym is offline", async () => {
    state.online = false;

    const result = await deleteCoachExercise("0001");

    expect(result).toEqual({ local: true, remote: "offline" });
    expect(state.updates).toHaveLength(0);
    expect(isExerciseDeleted("1")).toBe(true);
  });
});

describe("restoreCoachExercise", () => {
  it("puts the exercise back and writes the real equipment text again", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({ "0001": { deleted: true, availableInCronosGym: false, equipment_id: "NONE", syncStatus: "synced", dirty: false } }),
    );
    invalidateOverridesSnapshot();

    const result = await restoreCoachExercise("0001", row());

    expect(result.remote).toBe("updated");
    // Leaving "DELETED" behind would make the next hydration delete it again.
    expect(state.updates[0]).toEqual({ available_in_cronos_gym: true, equipment: "body weight" });
    const snapshot = readOverridesSnapshot();
    expect(snapshot.catalog["0001"]).toMatchObject({
      deleted: false,
      availableInCronosGym: true,
      syncStatus: "synced",
    });
    expect(isExerciseDeleted("0001")).toBe(false);
    expect(filterDeletedExercises([row()])).toHaveLength(1);
  });

  it("says the row is gone when the server cannot confirm the restore", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({ "0001": { deleted: true, syncStatus: "synced", dirty: false } }),
    );
    invalidateOverridesSnapshot();
    state.writtenIds = [];

    const result = await restoreCoachExercise("0001", row());

    expect(result.remote).toBe("unavailable");
    expect(result.detail).toEqual(expect.stringContaining("Supabase"));
    // The exercise is back for the coach, and the row says it is not everywhere.
    expect(isExerciseDeleted("0001")).toBe(false);
    expect(readOverridesSnapshot().catalog["0001"].syncStatus).toBe("local_only");
  });

  it("re-sends a removal this device still owes, and counts it once", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({ "0001": { deleted: true, dirty: true, syncStatus: "pending" } }),
    );
    invalidateOverridesSnapshot();

    const result = await syncPendingOverrides();

    expect(result.attempted).toBe(1);
    expect(result.synced).toBe(1);
    expect(result.stillPending).toBe(0);
    // A removal is its own write: sending it as a field update would leave the
    // free-text column untouched.
    expect(state.updates[0]).toEqual({ available_in_cronos_gym: false, equipment: "DELETED" });
  });
});

describe("uploadOrResolveCoachGif", () => {
  it("keeps a pasted URL and pins it to the exercise", async () => {
    const result = await uploadOrResolveCoachGif("https://cdn.example/demo.gif", "0001");

    expect(result).toEqual({ ok: true, url: "https://cdn.example/demo.gif", remote: "updated" });
    expect(state.updates[0]).toMatchObject({ gif_url: "https://cdn.example/demo.gif" });
    expect(state.uploads).toHaveLength(0);
  });

  it("rejects a URL that is not one", async () => {
    const result = await uploadOrResolveCoachGif("no-es-una-url", "0001");
    expect(result.ok).toBe(false);
  });

  it("uploads a file to the coach bucket and pins the public URL", async () => {
    const file = new File([new Uint8Array(2048)], "demo.gif", { type: "image/gif" });

    const result = await uploadOrResolveCoachGif(file, "0001");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain(`${COACH_GIF_BUCKET}/coach/0001-`);
    expect(result.url.endsWith(".gif")).toBe(true);
    expect(state.uploads).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ gif_url: result.url });
  });

  it("refuses a file that is not an image the catalog can render", async () => {
    const file = new File(["nope"], "notes.pdf", { type: "application/pdf" });
    const result = await uploadOrResolveCoachGif(file, "0001");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("GIF") });
    expect(state.uploads).toHaveLength(0);
  });

  it("refuses a file over the size limit before uploading", async () => {
    const big = new File([new Uint8Array(MAX_GIF_BYTES + 1)], "big.gif", { type: "image/gif" });
    const result = await uploadOrResolveCoachGif(big, "0001");
    expect(result.ok).toBe(false);
    expect(state.uploads).toHaveLength(0);
  });

  it("does not try to upload offline", async () => {
    state.online = false;
    const file = new File([new Uint8Array(64)], "demo.webp", { type: "image/webp" });
    const result = await uploadOrResolveCoachGif(file, "0001");
    expect(result.ok).toBe(false);
    expect(state.uploads).toHaveLength(0);
  });

  it("reports a storage refusal instead of throwing", async () => {
    state.uploadError = { message: "bucket not found" };
    const file = new File([new Uint8Array(64)], "demo.png", { type: "image/png" });
    const result = await uploadOrResolveCoachGif(file, "0001");
    expect(result).toEqual({ ok: false, error: "bucket not found" });
  });
});