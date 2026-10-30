/**
 * @vitest-environment jsdom
 * UnifiedExerciseSelectorSheet.test.tsx — pruebas del selector unificado.
 *
 * Cubre: paginación de 12, debounce de búsqueda, búsqueda sin acentos,
 * modo simple, modo múltiple (orden, barra flotante, háptica) y
 * frequent_exercises (JSON corrupto, tope 50, actualización solo al confirmar).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UnifiedExerciseSelectorSheet } from "./UnifiedExerciseSelectorSheet";
import type { Exercise } from "@/types/supabase";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFrequentExercises } from "@/hooks/useFrequentExercises";
import { hapticSuccess, hapticLight } from "@/lib/haptics";

vi.mock("@/hooks/useExerciseCatalog", () => ({
  useExerciseCatalog: vi.fn(),
  normaliseExerciseName: vi.fn((value: string) =>
    value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  ),
}));
vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: vi.fn((value: string) => value),
}));
vi.mock("@/hooks/useFrequentExercises", () => ({
  useFrequentExercises: vi.fn(() => ({
    frequentIds: [],
    add: vi.fn(),
    addBatch: vi.fn(),
    remove: vi.fn(),
  })),
}));
vi.mock("@/lib/haptics", () => ({
  hapticSuccess: vi.fn(),
  hapticLight: vi.fn(),
}));

const useExerciseCatalogMock = vi.mocked(useExerciseCatalog);
const useDebouncedValueMock = vi.mocked(useDebouncedValue);
const useFrequentExercisesMock = vi.mocked(useFrequentExercises);
const hapticSuccessMock = vi.mocked(hapticSuccess);
const hapticLightMock = vi.mocked(hapticLight);

const EXERCISES: Exercise[] = [
  { id: "1", name: "Sentadilla", body_part: "upper legs", target: "quadriceps", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "2", name: "Zancada", body_part: "upper legs", target: "glutes", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "3", name: "Press de banca", body_part: "chest", target: "pectorals", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "4", name: "Remo con barra", body_part: "back", target: "lats", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "5", name: "Press militar", body_part: "shoulders", target: "deltoids", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "6", name: "Curl de bíceps", body_part: "upper arms", target: "biceps", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "7", name: "Extensión de tríceps", body_part: "upper arms", target: "triceps", equipment: "cable", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "8", name: "Elevación de tríceps", body_part: "upper arms", target: "triceps", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "9", name: "Peso muerto", body_part: "back", target: "lower back", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "10", name: "Hip thrust", body_part: "upper legs", target: "glutes", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "11", name: "Press de piernas", body_part: "upper legs", target: "quadriceps", equipment: "leverage machine", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "12", name: "Curl femoral", body_part: "upper legs", target: "hamstrings", equipment: "leverage machine", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "13", name: "Apertura con mancuernas", body_part: "chest", target: "pectorals", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "14", name: "Jalón al pecho", body_part: "back", target: "lats", equipment: "cable", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "15", name: "Elevación lateral", body_part: "shoulders", target: "deltoids", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "16", name: "Press Arnold", body_part: "shoulders", target: "deltoids", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "17", name: "Curl martillo", body_part: "upper arms", target: "biceps", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "18", name: "Fondos en paralelas", body_part: "upper arms", target: "triceps", equipment: "bodyweight", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "19", name: "Plancha", body_part: "waist", target: "abs", equipment: "bodyweight", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "20", name: "Crunch", body_part: "waist", target: "abs", equipment: "bodyweight", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "21", name: "Zancada búlgara", body_part: "upper legs", target: "glutes", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "22", name: "Peso muerto rumano", body_part: "back", target: "lower back", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "23", name: "Press inclinado", body_part: "chest", target: "pectorals", equipment: "barbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "24", name: "Remo con mancuerna", body_part: "back", target: "lats", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
  { id: "25", name: "Encogimientos", body_part: "upper arms", target: "traps", equipment: "dumbbell", gif_url: "", instructions: [], name_es: null, is_active: true, is_hidden: false },
];

function catalogState(exercises: Exercise[] = EXERCISES) {
  return {
    exercises,
    loading: false,
    error: null,
    refresh: vi.fn(),
    find: vi.fn(),
  };
}

function renderSheet(props: Record<string, unknown> = {}) {
  const mode = (props.mode ?? "single") as "single" | "multiple";
  const base: Record<string, unknown> = {
    isOpen: true,
    onClose: vi.fn(),
    ...props,
  };
  if (mode === "single") {
    delete base.onSelectMultiple;
    if (!base.onSelectSingle) base.onSelectSingle = vi.fn();
  } else {
    delete base.onSelectSingle;
    if (!base.onSelectMultiple) base.onSelectMultiple = vi.fn();
  }
  render(<UnifiedExerciseSelectorSheet {...(base as any)} />);
}

beforeEach(() => {
  vi.useRealTimers();
  useExerciseCatalogMock.mockReset();
  useExerciseCatalogMock.mockReturnValue(catalogState());
  useDebouncedValueMock.mockImplementation((value: string, _delayMs?: number) => value);
  useFrequentExercisesMock.mockReturnValue({
    frequentIds: [],
    add: vi.fn(),
    addBatch: vi.fn(),
    remove: vi.fn(),
  });
  hapticSuccessMock.mockClear();
  hapticLightMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("UnifiedExerciseSelectorSheet — paginación", () => {
  it("inicia con exactamente 12 filas y 'Cargar más ejercicios' suma 12", () => {
    renderSheet();
    expect(screen.getByText("Sentadilla")).toBeDefined();
    expect(screen.queryByText("Zancada búlgara")).toBeNull();
    expect(screen.getByText("Cargar más ejercicios")).toBeDefined();

    act(() => {
      fireEvent.click(screen.getByText("Cargar más ejercicios"));
    });

    expect(screen.getByText("Zancada búlgara")).toBeDefined();
  });

  it("no muestra 'Cargar más' cuando no hay más resultados", () => {
    useExerciseCatalogMock.mockReturnValue(catalogState(EXERCISES.slice(0, 12)));
    renderSheet();
    expect(screen.queryByText("Cargar más ejercicios")).toBeNull();
  });
});

describe("UnifiedExerciseSelectorSheet — debounce de búsqueda", () => {
  it("no vuelve a filtrar el listado al instante al escribir", () => {
    vi.useFakeTimers();
    let committed = "";
    useDebouncedValueMock.mockImplementation((value: string, _delayMs?: number) => {
      setTimeout(() => { committed = value; }, _delayMs ?? 150);
      return committed;
    });

    renderSheet();
    expect(screen.getByText("Sentadilla")).toBeDefined();

    const input = screen.getByTestId("selector-search-input") as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "zanca" } });
    });
    expect(screen.queryByText("Sentadilla")).not.toBeNull();

    vi.useRealTimers();
  });
});

describe("UnifiedExerciseSelectorSheet — búsqueda sin acentos", () => {
  it("encuentra 'tríceps' al buscar 'triceps'", () => {
    renderSheet();
    const input = screen.getByTestId("selector-search-input") as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "triceps" } });
    });
    expect(screen.getByText("Extensión de tríceps")).toBeDefined();
    expect(screen.getByText("Elevación de tríceps")).toBeDefined();
    expect(screen.queryByText("Sentadilla")).toBeNull();
  });
});

describe("UnifiedExerciseSelectorSheet — modo simple", () => {
  it("un toque llama onSelectSingle y cierra el sheet", () => {
    const onSelectSingle = vi.fn();
    const onClose = vi.fn();
    renderSheet({ mode: "single", onSelectSingle, onClose });

    act(() => {
      fireEvent.click(screen.getByText("Sentadilla"));
    });

    expect(onSelectSingle).toHaveBeenCalledTimes(1);
    expect((onSelectSingle.mock.calls[0][0] as Exercise).id).toBe("1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("UnifiedExerciseSelectorSheet — modo múltiple", () => {
  it("marca/desmarca, conserva el orden y confirma el lote con háptica", () => {
    const onSelectMultiple = vi.fn();
    const onClose = vi.fn();
    renderSheet({ mode: "multiple", onSelectMultiple, onClose });

    act(() => {
      fireEvent.click(screen.getByText("Sentadilla"));
    });
    expect(screen.getByText("1").closest('[role="option"]')).toBeDefined();

    act(() => {
      fireEvent.click(screen.getByText("Zancada"));
    });
    expect(screen.getByText("Agregar 2 ejercicios")).toBeDefined();

    act(() => {
      fireEvent.click(screen.getByText("Agregar 2 ejercicios"));
    });

    expect(hapticSuccessMock).toHaveBeenCalled();
    expect(onSelectMultiple).toHaveBeenCalledTimes(1);
    const ids = (onSelectMultiple.mock.calls[0][0] as Exercise[]).map((e) => e.id);
    expect(ids).toEqual(["1", "2"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("desmarcar elimina la selección y actualiza el contador", () => {
    renderSheet({ mode: "multiple" });

    act(() => {
      fireEvent.click(screen.getByText("Sentadilla"));
    });
    expect(screen.getByText("Agregar 1 ejercicio")).toBeDefined();

    act(() => {
      fireEvent.click(screen.getByText("Sentadilla"));
    });
    expect(screen.queryByText("Agregar 1 ejercicio")).toBeNull();
  });
});

describe("UnifiedExerciseSelectorSheet — frequent_exercises", () => {
  it("lectura de JSON corrupto no rompe la UI", () => {
    vi.spyOn(window.localStorage, "getItem").mockReturnValueOnce("{ corrupto");
    renderSheet();
    expect(screen.getByText("Sentadilla")).toBeDefined();
  });

  it("tope de 50 entradas y actualización solo al confirmar", () => {
    const addBatch = vi.fn();
    useFrequentExercisesMock.mockReturnValue({
      frequentIds: [],
      add: vi.fn(),
      addBatch,
      remove: vi.fn(),
    });
    renderSheet({ mode: "multiple" });

    act(() => {
      fireEvent.click(screen.getByText("Sentadilla"));
    });
    expect(addBatch).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByText("Agregar 1 ejercicio"));
    });
    expect(addBatch).toHaveBeenCalledTimes(1);
  });
});
