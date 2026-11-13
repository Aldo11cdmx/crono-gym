/**
 * @vitest-environment jsdom
 *
 * The governance tab is where a coach fixes what the app shows: the GIF, the
 * full name, the machine. The catalog is supplied in memory so these assertions
 * are about the card, not about IndexedDB.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CoachPortal } from "./CoachPortal";
import type { CatalogExercise } from "@/lib/catalog/types";
import { EXERCISE_NAME_OVERRIDES_KEY, invalidateOverridesSnapshot } from "@/lib/catalog/customExercises";

const { catalogMock, serviceMock } = vi.hoisted(() => ({
  catalogMock: { rows: [] as CatalogExercise[] },
  serviceMock: { renameExerciseGlobal: vi.fn(async (_id: string, _name: string) => undefined) },
}));

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
    renameExerciseGlobal: (id: string, name: string) => serviceMock.renameExerciseGlobal(id, name),
  },
}));
vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: async () => catalogMock.rows,
  CatalogLoadError: class CatalogLoadError extends Error {},
}));
vi.mock("@lib/supabase", () => ({
  supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
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
  serviceMock.renameExerciseGlobal.mockClear();
});

afterEach(() => cleanup());

describe("CoachPortal · gobernanza de ejercicios", () => {
  it("shows the real GIF, the full name and the machine the row is mapped to", async () => {
    await openExercises();

    const gif = screen.getByRole("img", { name: /Demostración de Press de banca/i }) as HTMLImageElement;
    expect(gif.src).toContain("bench-medium.gif");
    expect(gif.className).toContain("object-contain");

    const name = screen.getByText("Press de banca");
    expect(name.className).toContain("break-words");
    expect(screen.getByText("0001 · Pecho")).toBeTruthy();

    const select = screen.getByLabelText("Máquina para Barbell Bench Press - Medium Grip") as HTMLSelectElement;
    expect(select.value).toBe("CG-EQP-0003");
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
    expect(serviceMock.renameExerciseGlobal).toHaveBeenCalledWith("0001", "Press banca plano");
    expect(
      JSON.parse(window.localStorage.getItem(EXERCISE_NAME_OVERRIDES_KEY) ?? "{}")["0001"],
    ).toBe("Press banca plano");
  });

  it("asks for more instead of mounting 1,324 cards at once", async () => {
    catalogMock.rows = Array.from({ length: 65 }, (_, index) =>
      row({ id: String(index + 1).padStart(4, "0"), name: `Ejercicio ${index + 1}`, name_es: `Ejercicio ${index + 1}` }),
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
});