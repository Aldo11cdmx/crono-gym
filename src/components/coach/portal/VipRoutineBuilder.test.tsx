/**
 * @vitest-environment jsdom
 *
 * The builder is the only screen where one user authors a row belonging to another, so the
 * assertions are about the *write*: that `source` and `authored_by_coach` are both present,
 * that the two inserts happen in the order the foreign key demands, and that a failed second
 * insert takes the routine row with it.
 *
 * That last one is the reason `authored_by_coach` exists as a column rather than as a
 * nicety. The compensating delete is scoped by `using (authored_by_coach = <the calling
 * coach>)`, which the server derives from `auth.uid()` -- so a routine saved without that
 * column is a row nobody can clean up if the exercises fail to land, and the athlete opens an
 * empty routine with no way to understand it. A test that only checked the happy path would
 * not notice the difference.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { VipRoutineBuilder } from "./VipRoutineBuilder";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";

const ATHLETE = "athlete-1";
const COACH = "coach-row-1";

const CATALOG = [
  { id: "ex-banca", name: "Press de banca" },
  { id: "ex-squat", name: "Sentadilla" },
  { id: "ex-remo", name: "Remo con barra" },
];

// ------------------------------------------------------------------- mocks

type Call = [string, ...unknown[]];

interface Write {
  table: string;
  values: unknown;
  filters: Call[];
}

interface Fixture {
  /** Reject the insert on this table. */
  failOn?: string | null;
  /** Leave the second insert pending until released. */
  holdExercises?: boolean;
}

let fixture: Fixture = {};
let writes: Write[] = [];
let releaseExercises: (() => void) | null = null;

vi.mock("@lib/supabase", () => ({
  supabase: {
    from(table: string) {
      const filters: Call[] = [];
      const builder: Record<string, unknown> = {};
      let deleting = false;

      for (const method of ["select", "eq"]) {
        builder[method] = (...args: unknown[]) => {
          filters.push([method as string, ...args]);
          return builder;
        };
      }

      builder.insert = (values: unknown) => {
        // Live reference: `insert()` runs before `.select()`/`.single()`, so a copy taken
        // here would always be empty and the payload assertions would pass against nothing.
        writes.push({ table, values, filters });
        return builder;
      };

      builder.delete = () => {
        deleting = true;
        writes.push({ table, values: null, filters });
        return builder;
      };

      builder.single = () => builder;

      builder.then = (resolve: (value: unknown) => void) => {
        if (deleting) return resolve({ data: null, error: null });

        const failure = fixture.failOn === table ? "rechazado" : null;

        if (table === "routines") {
          return resolve({
            data: failure ? null : { id: "routine-1" },
            error: failure ? { message: failure } : null,
          });
        }

        if (table === "exercises") {
          // Catalog reads resolve immediately with rows.
          return resolve({ data: CATALOG, error: null });
        }

        if (fixture.holdExercises && releaseExercises === null) {
          releaseExercises = () =>
            resolve({
              data: null,
              error: failure ? { message: failure } : null,
            });
          return undefined;
        }

        return resolve({
          data: null,
          error: failure ? { message: failure } : null,
        });
      };

      return builder;
    },
  },
}));

vi.mock("@/hooks/useExerciseCatalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useExerciseCatalog")>();
  return {
    ...actual,
    useExerciseCatalog: () => ({
      exercises: CATALOG,
      loading: false,
      error: null,
      refresh: vi.fn(async () => undefined),
      find: () => null,
    }),
  };
});

vi.mock("@/lib/coach/useCoachAuth", () => ({
  getCoachId: () => COACH,
}));

let selectedSheetExercises: typeof CATALOG = [];

vi.mock("@/components/UnifiedExerciseSelectorSheet", () => ({
  UnifiedExerciseSelectorSheet: ({ isOpen, onClose, onSelectMultiple }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="unified-selector-sheet">
        {CATALOG.map((ex) => (
          <button
            key={ex.id}
            data-testid={`selector-exercise-${ex.id}`}
            onClick={() => {
              if (selectedSheetExercises.some((e) => e.id === ex.id)) {
                selectedSheetExercises = selectedSheetExercises.filter((e) => e.id !== ex.id);
              } else {
                selectedSheetExercises = [...selectedSheetExercises, ex];
              }
            }}
          >
            {ex.name}
          </button>
        ))}
        <button
          data-testid="selector-confirm"
          onClick={() => {
            onSelectMultiple(selectedSheetExercises);
            selectedSheetExercises = [];
            onClose();
          }}
        >
          Confirmar
        </button>
        <button data-testid="selector-cancel" onClick={onClose}>
          Cancelar
        </button>
      </div>
    );
  },
}));

/** Mounts the builder with a title and one exercise already chosen. */
async function mountReady(title = "Fuerza 4 días") {
  const view = render(<VipRoutineBuilder athleteId={ATHLETE} />);
  fireEvent.change(screen.getByLabelText(T.builderRoutineTitleLabel), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: T.builderAddExercise }));
  fireEvent.click(screen.getByRole("button", { name: "Press de banca" }));
  fireEvent.click(screen.getByTestId("selector-confirm"));
  return view;
}

/** The insert rows for `routine_exercises`, as recorded. */
function exerciseRows(): Record<string, unknown>[] {
  const write = writes.find((w) => w.table === "routine_exercises");
  return (write?.values ?? []) as Record<string, unknown>[];
}

beforeEach(() => {
  fixture = {};
  writes = [];
  releaseExercises = null;
  selectedSheetExercises = [];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------------- tests

describe("VipRoutineBuilder · la escritura", () => {
  it("guarda con source human_coach y authored_by_coach", async () => {
    await mountReady();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    const routine = writes.find((w) => w.table === "routines");
    expect(routine?.values).toMatchObject({
      user_id: ATHLETE,
      title: "Fuerza 4 días",
      source: "human_coach",
      authored_by_coach: COACH,
    });
  });

  it("escribe la rutina del atleta, no la del coach", async () => {
    await mountReady();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    // The coach authors; the athlete owns. Conflating them would write the routine into the
    // coach's own library and show the athlete nothing.
    expect(writes.find((w) => w.table === "routines")?.values).toMatchObject({
      user_id: ATHLETE,
    });
  });

  it("escribe las reps, los días y el orden", async () => {
    await mountReady();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    /*
     * `target_reps_min` / `target_reps_max` are the columns `saveGeneratedRoutine` has to
     * drop because they did not exist. A coach prescribing "8-12" whose athlete can only see
     * "4 series" is a plan that lost its point on the way to the database.
     */
    expect(exerciseRows()).toEqual([
      expect.objectContaining({
        routine_id: "routine-1",
        exercise_id: "ex-banca",
        target_sets: 4,
        target_reps_min: 8,
        target_reps_max: 12,
        rest_seconds: 90,
        day_index: 0,
        order_index: 0,
      }),
    ]);
  });

  it("inserta la rutina antes que sus ejercicios", async () => {
    await mountReady();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    // `routine_exercises.routine_id` is a foreign key. The other order writes rows pointing
    // at nothing, which are invisible *and* orphaned.
    expect(writes.map((w) => w.table)).toEqual(["routines", "routine_exercises"]);
  });

  it("agrupa por día con day_index y day_label", async () => {
    await mountReady("Fuerza 2 días");

    fireEvent.click(screen.getByRole("button", { name: T.builderAddDay }));
    fireEvent.change(screen.getAllByLabelText(T.builderDayNameLabel)[0], {
      target: { value: "Pecho" },
    });
    const addButtons = screen.getAllByRole("button", { name: T.builderAddExercise });
    fireEvent.click(addButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Sentadilla" }));
    fireEvent.click(screen.getByTestId("selector-confirm"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    const rows = exerciseRows();
    expect(rows.map((row) => row.day_index)).toEqual([0, 1]);
    expect(rows[0].day_label).toBe("Pecho");
    // `order_index` restarts inside each day, which is what makes
    // `(day_index, order_index)` a total order.
    expect(rows.map((row) => row.order_index)).toEqual([0, 0]);
  });
});

describe("VipRoutineBuilder · la limpieza compensatoria", () => {
  it("borra la rutina si los ejercicios no se guardan", async () => {
    fixture = { failOn: "routine_exercises" };
    await mountReady();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    // A routine the athlete can open and find empty is worse than no routine at all, and
    // this delete is legal only because `authored_by_coach` names the author.
    const cleanup = writes.filter((w) => w.table === "routines").at(-1);
    expect(cleanup?.values).toBeNull();
    expect(cleanup?.filters).toContainEqual(["eq", "id", "routine-1"]);
  });

  it("informa del fallo en vez de dejar el botón girando", async () => {
    fixture = { failOn: "routine_exercises" };
    await mountReady();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    await waitFor(() => expect(screen.getByText(T.builderSaveError)).toBeTruthy());
  });

  it("no borra nada cuando el guardado funciona", async () => {
    await mountReady();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    expect(writes.filter((w) => w.table === "routines")).toHaveLength(1);
    expect(screen.getByText(T.builderSaved("Fuerza 4 días"))).toBeTruthy();
  });

  it("limpia el borrador tras guardar, para que un doble toque no duplique la rutina", async () => {
    await mountReady();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    // The fields are empty again and the button is disabled: saving twice has to be a
    // deliberate second act, not the tail of the first one.
    expect((screen.getByLabelText(T.builderRoutineTitleLabel) as HTMLInputElement).value).toBe("");
  });
});

describe("VipRoutineBuilder · lo que no se puede guardar", () => {
  it("no guarda sin nombre", async () => {
    await mountReady("");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    expect(writes).toEqual([]);
  });

  it("no guarda sin ejercicios", async () => {
    const view = render(<VipRoutineBuilder athleteId={ATHLETE} />);
    fireEvent.change(screen.getByLabelText(T.builderRoutineTitleLabel), {
      target: { value: "Vacía" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    expect(writes).toEqual([]);
    expect(view.container.textContent).toBeTruthy();
  });

  it("no guarda con un ejercicio sin elegir en la fila", async () => {
    // The row exists but has no id, so there is nothing to point a foreign key at.
    render(<VipRoutineBuilder athleteId={ATHLETE} />);
    fireEvent.change(screen.getByLabelText(T.builderRoutineTitleLabel), {
      target: { value: "A medio hacer" },
    });
    fireEvent.click(screen.getByRole("button", { name: T.builderAddExercise }));

    const save = screen.getByRole("button", { name: T.builderSave });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("VipRoutineBuilder · selector unificado", () => {
  it("abre la hoja unificada al agregar ejercicios a un día", async () => {
    await mountReady();

    fireEvent.click(screen.getByRole("button", { name: T.builderAddExercise }));
    expect(screen.getByTestId("unified-selector-sheet")).toBeTruthy();
  });

  it("inyecta el lote seleccionado en el día al confirmar", async () => {
    await mountReady();

    fireEvent.click(screen.getByRole("button", { name: T.builderAddExercise }));
    fireEvent.click(screen.getByRole("button", { name: "Sentadilla" }));
    fireEvent.click(screen.getByTestId("selector-confirm"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    expect(exerciseRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exercise_id: "ex-banca" }),
        expect.objectContaining({ exercise_id: "ex-squat" }),
      ]),
    );
  });

  it("no inyecta ejercicios al cancelar la hoja", async () => {
    await mountReady();

    fireEvent.click(screen.getByRole("button", { name: T.builderAddExercise }));
    fireEvent.click(screen.getByRole("button", { name: "Sentadilla" }));
    fireEvent.click(screen.getByTestId("selector-cancel"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: T.builderSave }));
    });

    expect(exerciseRows()).toEqual([
      expect.objectContaining({ exercise_id: "ex-banca" }),
    ]);
  });
});

describe("VipRoutineBuilder · sin atleta", () => {
  it("pide elegir una solicitud y no escribe nada", () => {
    render(<VipRoutineBuilder athleteId={null} />);

    expect(screen.getByText(T.builderSelectPrompt)).toBeTruthy();
    expect(screen.queryByRole("button", { name: T.builderSave })).toBeNull();
  });
});

describe("VipRoutineBuilder · días", () => {
  it("quita un díaadded por el coach", async () => {
    await mountReady();

    fireEvent.click(screen.getByRole("button", { name: T.builderAddDay }));
    expect(screen.getByRole("button", { name: T.builderRemoveDay(2) })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: T.builderRemoveDay(2) }));
    expect(screen.queryByRole("button", { name: T.builderRemoveDay(2) })).toBeNull();
  });

  it("no deja quedarse sin días", async () => {
    await mountReady();

    // The last day has no remove button: taking it would leave nothing to type into and no
    // way back except a reload.
    expect(screen.queryByRole("button", { name: T.builderRemoveDay(1) })).toBeNull();
  });

  it("da un id distinto a cada campo, para que cada etiqueta apunte al suyo", async () => {
    await mountReady();

    fireEvent.click(screen.getByRole("button", { name: T.builderAddDay }));
    fireEvent.click(screen.getAllByRole("button", { name: T.builderAddExercise })[1]);

    const ids = [...document.querySelectorAll("input")].map((node) => node.id);
    // Sixteen collisions on a four-day screen: every `<label for>` would point at the first
    // match, so clicking "Series" in day two would put the caret in day one.
    expect(new Set(ids).size).toBe(ids.length);
  });
});