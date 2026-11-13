// @vitest-environment jsdom
/**
 * The two tiers, and what each one does when the other is unavailable.
 *
 * Tier 1 is the point of the module: the coach sees the change in the frame it
 * was made. Tier 2 is the reason the change survives a cache clear -- and the
 * 42703 fallback is the reason a rename still lands before the migration runs.
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
  hydrateOverridesFromSupabase,
  isUndefinedColumn,
  persistCoachExerciseChange,
  uploadOrResolveCoachGif,
} from "./coachCatalogSync";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  listError: null as null | { code?: string; message?: string },
  upsertError: null as null | { code?: string; message?: string },
  updateError: null as null | { code?: string; message?: string },
  uploadError: null as null | { message: string },
  /** How many writes fail before the mock starts succeeding. */
  upsertFailsLeft: 0,
  selectFailsLeft: 0,
  upserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
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
      upsert(payload: Record<string, unknown>) {
        state.upserts.push(payload);
        const error = state.upsertFailsLeft > 0 ? state.upsertError : null;
        if (state.upsertFailsLeft > 0) state.upsertFailsLeft -= 1;
        return Promise.resolve({ error });
      },
      update(payload: Record<string, unknown>) {
        state.updates.push(payload);
        return builder;
      },
      eq() {
        return Promise.resolve({ error: state.updateError });
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
  state.upsertError = null;
  state.updateError = null;
  state.uploadError = null;
  state.upsertFailsLeft = 0;
  state.selectFailsLeft = 0;
  state.upserts = [];
  state.updates = [];
  state.selects = [];
  state.uploads = [];
  state.online = true;
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => state.online });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("persistCoachExerciseChange", () => {
  it("writes the override locally and upserts the whole row remotely", async () => {
    const result = await persistCoachExerciseChange("0001", {
      equipment_id: "CG-EQP-0012",
      station_key: "flat_bench",
      availableInCronosGym: false,
    });

    expect(result).toEqual({ local: true, remote: "upserted" });
    expect(readOverridesSnapshot().catalog["0001"]).toMatchObject({
      equipment_id: "CG-EQP-0012",
      station_key: "flat_bench",
      availableInCronosGym: false,
    });
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({
      id: "0001",
      name: "Push-up",
      equipment: "body weight",
      equipment_id: "CG-EQP-0012",
      station_key: "flat_bench",
      available_in_cronos_gym: false,
    });
  });

  it("announces the change, so open screens re-resolve", async () => {
    const listener = vi.fn();
    window.addEventListener("cronos:catalog-updated", listener);
    await persistCoachExerciseChange("0001", { gif_url: "https://cdn.example/new.gif" });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("cronos:catalog-updated", listener);
  });

  it("falls back to the base columns when the server has not been migrated", async () => {
    state.upsertError = { code: "42703", message: "column equipment_id does not exist" };
    state.upsertFailsLeft = 1;

    const result = await persistCoachExerciseChange(
      "0001",
      { equipment_id: "CG-EQP-0012", customNameEs: "Press banca" },
      row(),
    );

    expect(result.remote).toBe("upserted");
    expect(state.upserts).toHaveLength(2);
    expect(state.upserts[1]).toMatchObject({
      id: "0001",
      name: "Press banca",
      equipment: "body weight",
      gif_url: "https://cdn.example/shipped.gif",
    });
    expect(state.upserts[1]).not.toHaveProperty("equipment_id");
    // The rename is still on the device, so the app shows it without the server.
    expect(readOverridesSnapshot().catalog["0001"].customNameEs).toBeUndefined();
    expect(JSON.parse(window.localStorage.getItem(EXERCISE_NAME_OVERRIDES_KEY) ?? "{}")["0001"]).toBe(
      "Press banca",
    );
  });

  it("updates only the governance columns when there is no row to insert", async () => {
    resetCatalogRegistry();

    const result = await persistCoachExerciseChange("9999", { availableInCronosGym: false });

    expect(result.remote).toBe("updated");
    expect(state.upserts).toHaveLength(0);
    expect(state.updates[0]).toEqual({ available_in_cronos_gym: false });
  });

  it("keeps the change local when the device is offline, and writes nothing remote", async () => {
    state.online = false;

    const result = await persistCoachExerciseChange("0001", { equipment_id: "CG-EQP-0012" });

    expect(result).toEqual({ local: true, remote: "offline" });
    expect(state.upserts).toHaveLength(0);
    expect(readOverridesSnapshot().catalog["0001"].equipment_id).toBe("CG-EQP-0012");
  });

  it("reports a refusal instead of throwing", async () => {
    state.upsertError = { code: "42501", message: "new row violates row-level security" };
    state.upsertFailsLeft = 1;

    const result = await persistCoachExerciseChange("0001", { equipment_id: "CG-EQP-0012" });

    expect(result).toEqual({ local: true, remote: "unavailable", detail: expect.any(String) });
    expect(readOverridesSnapshot().catalog["0001"].equipment_id).toBe("CG-EQP-0012");
  });

  it("recognises the undefined-column error by code or by message", () => {
    expect(isUndefinedColumn({ code: "42703" })).toBe(true);
    expect(isUndefinedColumn({ message: 'column "station_key" does not exist' })).toBe(true);
    expect(isUndefinedColumn({ code: "42501" })).toBe(false);
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

  it("says offline rather than reporting an empty catalog", async () => {
    state.online = false;
    const result = await hydrateOverridesFromSupabase();
    expect(result).toEqual({ hydrated: 0, remote: "unavailable", detail: "offline" });
  });
});

describe("uploadOrResolveCoachGif", () => {
  it("keeps a pasted URL and pins it to the exercise", async () => {
    const result = await uploadOrResolveCoachGif("https://cdn.example/demo.gif", "0001");

    expect(result).toEqual({ ok: true, url: "https://cdn.example/demo.gif", remote: "upserted" });
    expect(state.upserts[0]).toMatchObject({ gif_url: "https://cdn.example/demo.gif" });
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
    expect(state.upserts[0]).toMatchObject({ gif_url: result.url });
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