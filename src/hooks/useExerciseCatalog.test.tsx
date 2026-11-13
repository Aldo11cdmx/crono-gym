// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogExercise } from "@/lib/catalog/types";
import { CATALOG_OVERRIDES_KEY, invalidateOverridesSnapshot } from "@/lib/catalog/customExercises";
import { useExerciseCatalog } from "./useExerciseCatalog";

const loadCatalog = vi.fn(async (): Promise<CatalogExercise[]> => []);

vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: () => loadCatalog(),
  CatalogLoadError: class CatalogLoadError extends Error {},
}));

const cacheStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@/lib/cache", () => ({
  catalogCache: {
    get: (key: string) => cacheStore.get(key) ?? null,
    set: (key: string, value: unknown) => void cacheStore.set(key, value),
  },
}));

function row(overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id: "0001",
    name: "Push-up",
    name_es: null,
    category: "strength",
    body_part: "chest",
    equipment: "body weight",
    gif_url: "https://cdn.example/0001.gif",
    image: "https://cdn.example/0001.jpg",
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
  cacheStore.clear();
  loadCatalog.mockReset();
  loadCatalog.mockResolvedValue([row(), row({ id: "0002", name: "Pull-up", target: "lats" })]);
});

describe("useExerciseCatalog", () => {
  it("hands back the catalog with names and machines resolved", async () => {
    const { result } = renderHook(() => useExerciseCatalog());

    await waitFor(() => expect(result.current.exercises).toHaveLength(2));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.exercises[0].name_es).toBe("Flexión");
  });

  it("shows the wait only for the first read, so a rename is not a spinner", async () => {
    const { result } = renderHook(() => useExerciseCatalog());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.exercises).toHaveLength(2));
    expect(result.current.loading).toBe(false);

    act(() => {
      window.localStorage.setItem(
        CATALOG_OVERRIDES_KEY,
        JSON.stringify({ "0001": { customNameEs: "Push-up estricto" } }),
      );
      window.dispatchEvent(new CustomEvent("cronos:catalog-updated"));
    });

    await waitFor(() =>
      expect(result.current.exercises[0].name_es).toBe("Push-up estricto"),
    );
    expect(result.current.loading).toBe(false);
    expect(loadCatalog).toHaveBeenCalledTimes(1);
  });

  it("reports a failed read as a message, not a silent empty picker", async () => {
    loadCatalog.mockRejectedValue(new Error("sin conexión"));
    const { result } = renderHook(() => useExerciseCatalog());

    await waitFor(() => expect(result.current.error).toBe("sin conexión"));
    expect(result.current.exercises).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("finds a row by name, scoped to the muscle the import mapped", async () => {
    const { result } = renderHook(() => useExerciseCatalog());
    await waitFor(() => expect(result.current.exercises).toHaveLength(2));

    expect(result.current.find("push up")?.id).toBe("0001");
    expect(result.current.find("flexión")?.id).toBe("0001");
    expect(result.current.find("pull-up", "lats")?.id).toBe("0002");
    expect(result.current.find("pull-up", "chest")).toBeNull();
    expect(result.current.find("no existe")).toBeNull();
    expect(result.current.find("")).toBeNull();
  });
});