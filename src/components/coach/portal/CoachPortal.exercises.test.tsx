/**
 * @vitest-environment jsdom
 *
 * The governance tab is where a coach fixes what the app shows: the GIF, the
 * full name, the machine. The catalog is supplied in memory so these assertions
 * are about the card, not about IndexedDB, and the Supabase client is a chain
 * that records what the panel tried to write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CoachPortal } from "./CoachPortal";
import type { CatalogExercise } from "@/lib/catalog/types";
import {
  CATALOG_OVERRIDES_KEY,
  invalidateOverridesSnapshot,
  readOverridesSnapshot,
} from "@/lib/catalog/customExercises";

const { catalogMock, dbMock } = vi.hoisted(() => {
  const state = {
    upserts: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    uploads: [] as { path: string; size: number }[],
    selects: 0,
  };
  // A chainable thenable: `select().limit()` and `update().eq()` both have to
  // resolve, so every link returns the same builder and only the leaves await.
  const chain: any = {
    select: () => {
      state.selects += 1;
      return chain;
    },
    limit: () => Promise.resolve({ error: null, data: [] as Record<string, unknown>[] }),
    upsert: (row: Record<string, unknown>) => {
      state.upserts.push(row);
      return Promise.resolve({ error: null });
    },
    update: (patch: Record<string, unknown>) => {
      state.updates.push(patch);
      return chain;
    },
    eq: () => Promise.resolve({ error: null }),
    insert: () => Promise.resolve({ error: null }),
  };
  return { catalogMock: { rows: [] as CatalogExercise[] }, dbMock: { state, chain } };
});

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ userId: "coach-1" }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasRole: () => true }),
}));
vi.mock("@/lib/coach/useCoachAuth", () => ({
  useCoachAuth: () => ({ lock: vi.fn() }),
}));
vi.mock("@/hooks/useCoachEcosystem", () => ({
  useCoachEcosystem: () => ({
    loading: false,
    offer: null,
    requests: [],
    templates: [],
    exerciseRequests: [],
    refresh: vi.fn(async () => undefined),
    saveOffer: vi.fn(async (value: unknown) => value),
    activateAthleteVipCash: vi.fn(async () => undefined),
    cloneTemplate: vi.fn(async () => "routine-1"),
  }),
}));
vi.mock("./CoachAthleteSearch", () => ({ CoachAthleteSearch: () => <div>Buscar atleta por nombre</div> }));
vi.mock("./AthleteCRM", () => ({ AthleteCRM: () => <div>Ficha</div> }));
vi.mock("./VipRoutineBuilder", () => ({ VipRoutineBuilder: () => <div>Constructor 1:1</div> }));
vi.mock("@/lib/coach/coachEcosystemService", () => ({
  coachEcosystemService: {
    requestExercise: vi.fn(async () => undefined),
  },
}));
vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: async () => catalogMock.rows,
  CatalogLoadError: class CatalogLoadError extends Error {},
}));
vi.mock("@lib/supabase", () => ({
  supabase: {
    from: () => dbMock.chain,
    storage: {
      from: () => ({
        upload: async (path: string, _body: unknown) => {
          dbMock.state.uploads.push({ path, size: 8 });
          return { error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://media.example/${path}` },
        }),
      }),
    },
  },
}));

function row(overrides: Partial<CatalogExercise> = {}): CatalogExercise {
  return {
    id: "0001",
    name: "Barbell Bench Press - Medium Grip",
    name_es: "Press de banca",
    category: "strength",
    body_part: "chest",
    equipment: "barbell",
    gif_url: "https://cdn.example/bench-medium.gif",
    image: "https://cdn.example/bench-medium.jpg",
    muscle_group: "chest",
    secondary_muscles: [],
    target: "pectorals",
    availableInCronosGym: true,
    equipment_id: "CG-EQP-0003",
    equipment_name: "Press de banca",
    instructions: {},
    instruction_steps: {},
    media_id: "0001",
    created_at: "2026-01-01T00:00:00.000Z",
    attribution: null,
    ...overrides,
  };
}

async function openExercises() {
  render(<CoachPortal />);
  fireEvent.click(screen.getByRole("button", { name: "Ejercicios" }));
  await waitFor(() => expect(screen.getByText("Gobernanza de ejercicios")).toBeTruthy());
}

beforeEach(() => {
  window.localStorage.clear();
  invalidateOverridesSnapshot();
  catalogMock.rows = [row()];
  dbMock.state.upserts = [];
  dbMock.state.updates = [];
  dbMock.state.uploads = [];
  dbMock.state.selects = 0;
});

afterEach(() => cleanup());

describe("CoachPortal · gobernanza de ejercicios", () => {
  it("shows the real GIF, the full name and the machine the row is mapped to", async () => {
    await openExercises();

    const gif = screen.getByRole("img", {
      name: /Demostración de Press de banca/i,
    }) as HTMLImageElement;
    expect(gif.src).toContain("bench-medium.gif");
    expect(gif.className).toContain("object-contain");

    expect(screen.getByText("Press de banca").className).toContain("break-words");
    expect(screen.getByText("0001 · Pecho")).toBeTruthy();

    // The machine is a picture and an id, not a select with 77 options.
    const picker = screen.getByLabelText("Máquina para Barbell Bench Press - Medium Grip");
    expect(picker.textContent).toContain("CG-EQP-0003");
    expect(screen.getByText("Disponible")).toBeTruthy();
  });

  it("marks a row the gym cannot host", async () => {
    catalogMock.rows = [row({ availableInCronosGym: false })];
    await openExercises();
    expect(screen.getByText("No disponible")).toBeTruthy();
  });

  it("keeps the coach's rename in the store, not only on the card", async () => {
    await openExercises();

    fireEvent.click(screen.getByRole("button", { name: /Renombrar/ }));
    const input = screen.getByLabelText("Nuevo nombre para Barbell Bench Press - Medium Grip");
    fireEvent.change(input, { target: { value: "Press banca plano" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByText("Press banca plano")).toBeTruthy());
    expect(readOverridesSnapshot().names["0001"]).toBe("Press banca plano");
    // Tier 2: the rename is written to the server as the exercise's name.
    expect(dbMock.state.upserts[0]?.name).toBe("Press banca plano");
  });

  it("assigns a machine through the picker and persists it", async () => {
    await openExercises();

    fireEvent.click(screen.getByLabelText("Máquina para Barbell Bench Press - Medium Grip"));
    const search = screen.getByLabelText("Buscar máquina");
    fireEvent.change(search, { target: { value: "polea" } });

    fireEvent.click(await screen.findByRole("button", { name: /Jalon Pecho Polea/i }));

    await waitFor(() =>
      expect(readOverridesSnapshot().catalog["0001"]?.equipment_id).toMatch(/^CG-EQP-\d{4}$/),
    );
    // The write carries the machine; "Sin máquina" would have to clear it.
    expect(dbMock.state.upserts.some((row_) => "equipment_id" in row_)).toBe(true);
  });

  it("clears the machine when the coach picks floor work", async () => {
    await openExercises();

    fireEvent.click(screen.getByLabelText("Máquina para Barbell Bench Press - Medium Grip"));
    fireEvent.click(screen.getByRole("button", { name: /Sin máquina/ }));

    await waitFor(() =>
      expect(readOverridesSnapshot().catalog["0001"]?.equipment_id).toBeUndefined(),
    );
    expect(screen.getByText(/Peso libre \/ Piso/)).toBeTruthy();
  });

  it("saves the demonstration the coach pasted, and the card follows", async () => {
    await openExercises();

    fireEvent.click(screen.getByLabelText("Cambiar GIF de Barbell Bench Press - Medium Grip"));
    fireEvent.change(screen.getByLabelText("URL de la demostración"), {
      target: { value: "https://cdn.example/propio.gif" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar URL" }));

    await waitFor(() =>
      expect(readOverridesSnapshot().catalog["0001"]?.gif_url).toBe("https://cdn.example/propio.gif"),
    );
    expect(dbMock.state.upserts.concat(dbMock.state.updates).some((row_) => row_.gif_url === "https://cdn.example/propio.gif")).toBe(true);
    const gif = await screen.findByRole("img", {
      name: /Demostración de Press de banca/i,
    });
    expect((gif as HTMLImageElement).src).toContain("propio.gif");
  });

  it("refuses a URL that is not a URL", async () => {
    await openExercises();

    fireEvent.click(screen.getByLabelText("Cambiar GIF de Barbell Bench Press - Medium Grip"));
    fireEvent.change(screen.getByLabelText("URL de la demostración"), { target: { value: "mi-gif" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar URL" }));

    expect(await screen.findByText(/debe empezar por http/)).toBeTruthy();
    expect(readOverridesSnapshot().catalog["0001"]?.gif_url).toBeUndefined();
  });

  it("counts the exercises the chips keep, without changing the rows", async () => {
    catalogMock.rows = [
      row(),
      row({ id: "0002", name: "Pull-up", name_es: "Dominada", body_part: "back", equipment_id: "NONE" }),
    ];
    await openExercises();

    expect(screen.getByText("2 de 2 ejercicios del catálogo local")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Peso libre" }));
    expect(screen.getByText("Dominada")).toBeTruthy();
    expect(screen.queryByText("Press de banca")).toBeNull();
  });

  it("says when the catalog is only local", async () => {
    await openExercises();
    // The mock answers the hydration read, so the panel must claim a connection
    // only when it actually got one.
    expect(await screen.findByText(/Conectado a Supabase|Solo local/)).toBeTruthy();
  });

  it("asks for more instead of mounting 1,324 cards at once", async () => {
    catalogMock.rows = Array.from({ length: 65 }, (_, index) =>
      row({
        id: String(index + 1).padStart(4, "0"),
        name: `Ejercicio ${index + 1}`,
        name_es: `Ejercicio ${index + 1}`,
      }),
    );
    await openExercises();

    expect(screen.getAllByLabelText(/^Máquina para /)).toHaveLength(60);
    fireEvent.click(screen.getByRole("button", { name: /Mostrar más/ }));

    await waitFor(() => expect(screen.getAllByLabelText(/^Máquina para /)).toHaveLength(65));
  }, 30000);

  it("searches by catalog id as well as by name", async () => {
    catalogMock.rows = [row(), row({ id: "0002", name: "Pull-up", name_es: "Dominada", body_part: "back" })];
    await openExercises();

    fireEvent.change(screen.getByPlaceholderText("Buscar ejercicio"), { target: { value: "0002" } });
    expect(screen.getByText("Dominada")).toBeTruthy();
    expect(screen.queryByText("Press de banca")).toBeNull();
  });

  it("keeps the store in sync between reads of the same override", async () => {
    window.localStorage.setItem(
      CATALOG_OVERRIDES_KEY,
      JSON.stringify({ "0001": { equipment_id: "CG-EQP-0011" } }),
    );
    invalidateOverridesSnapshot();
    await openExercises();

    const picker = screen.getByLabelText("Máquina para Barbell Bench Press - Medium Grip");
    expect(picker.textContent).toContain("CG-EQP-0011");
    expect(screen.getByText(/Editados por coach/)).toBeTruthy();
  });
});