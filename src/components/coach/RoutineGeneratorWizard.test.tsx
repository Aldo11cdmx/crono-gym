/**
 * @vitest-environment jsdom
 *
 * The wizard's three steps are three different things -- a form, a wait, and a result --
 * so these tests are organised by what each step has to do rather than by component
 * structure. The step that matters most is the middle one: loading, cancelling and
 * failing are all states of the network call, and none of them is reachable without
 * injecting a transport that can hang on demand.
 *
 * The persistence seam is injected too, so no test here needs a database, and so
 * "Guardar" can be asserted on the routine that was handed over rather than on a
 * successful insert that would also pass for a successful no-op.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RoutineGeneratorWizard } from "./RoutineGeneratorWizard";
import type { GeneratedRoutine, RoutineTransport } from "@/lib/ai/routineGenerator";
import type { AssistantResponse } from "@/lib/ai/coachAssistant";

const CATALOG = [
  { id: "ex-press", body_part: "chest" },
  { id: "ex-fly", body_part: "chest" },
  { id: "ex-row", body_part: "back" },
];

const NAMES = {
  "ex-press": "Press de banca",
  "ex-fly": "Aperturas en polea",
  "ex-row": "Remo con barra",
};

const ROUTINE: GeneratedRoutine = {
  name: "Pecho y espalda",
  days: [
    {
      dayNumber: 1,
      focus: "Empuje",
      exercises: [
        { exerciseId: "ex-press", sets: 4, repsMin: 8, repsMax: 10, restSeconds: 120 },
        { exerciseId: "ex-fly", sets: 3, repsMin: 12, repsMax: 12, restSeconds: 90 },
      ],
    },
    {
      dayNumber: 2,
      focus: "Tirón",
      exercises: [{ exerciseId: "ex-row", sets: 4, repsMin: 6, repsMax: 8, restSeconds: 150 }],
    },
  ],
};

function replyWith(routine: GeneratedRoutine): RoutineTransport {
  return async () => ({ message: JSON.stringify(routine) });
}

/**
 * A save spy with the real signature.
 *
 * The assertions below index into `mock.calls[0]`, which a zero-argument mock types as
 * `undefined` and so could not compile into a check.
 */
function okSave() {
  return vi.fn<(userId: string, routine: GeneratedRoutine) => Promise<boolean>>(
    async () => true,
  );
}

/** The same spy, refusing the write. */
function failingSave() {
  return vi.fn<(userId: string, routine: GeneratedRoutine) => Promise<boolean>>(
    async () => false,
  );
}

function renderWizard(overrides: Partial<Parameters<typeof RoutineGeneratorWizard>[0]> = {}) {
  const props = {
    userId: "u1",
    catalog: CATALOG,
    exerciseNames: NAMES,
    transport: replyWith(ROUTINE),
    save: okSave(),
    ...overrides,
  };
  const view = render(<RoutineGeneratorWizard {...props} />);
  return { ...view, props };
}

afterEach(cleanup);

// ------------------------------------------------------------------- step 1

describe("RoutineGeneratorWizard · parámetros", () => {
  it("renderiza los tres controles antes de pedir nada", () => {
    renderWizard();

    expect(screen.getByText("Objetivo")).toBeTruthy();
    expect(screen.getByText("Días por semana")).toBeTruthy();
    expect(screen.getByText("Duración de sesión")).toBeTruthy();
    // Nothing has been sent, so the network is not involved yet.
    expect(screen.getByText("3 días")).toBeTruthy();
  });

  it("expone los objetivos como un grupo de radio con una sola selección", () => {
    renderWizard();

    const group = screen.getByRole("radiogroup", { name: "Objetivo" });
    const options = [
      screen.getByRole("radio", { name: "Volumen" }),
      screen.getByRole("radio", { name: "Definición" }),
      screen.getByRole("radio", { name: "Mantenimiento" }),
    ];
    expect(within(group).getAllByRole("radio")).toHaveLength(options.length);
    expect(screen.getByRole("radio", { name: "Volumen" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("radio", { name: "Definición" }));
    expect(screen.getByRole("radio", { name: "Definición" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Volumen" }).getAttribute("aria-checked")).toBe("false");
  });

  it("no deja bajar de dos ni subir de seis días", () => {
    renderWizard();

    const decrease = screen.getByRole("button", { name: "Quitar un día de entrenamiento" });
    const increase = screen.getByRole("button", { name: "Añadir un día de entrenamiento" });

    fireEvent.click(decrease);
    fireEvent.click(decrease);
    expect(screen.getByText("2 días")).toBeTruthy();
    // A seventh day is not a routine this app can render, so the button stops existing as
    // an action rather than existing and doing nothing.
    expect((decrease as HTMLButtonElement).disabled).toBe(true);

    for (let i = 0; i < 5; i += 1) fireEvent.click(increase);
    expect(screen.getByText("6 días")).toBeTruthy();
    expect((increase as HTMLButtonElement).disabled).toBe(true);
  });

  it("elige la duración con un chip pulsable, no con un desplegable", () => {
    renderWizard();

    const chip = screen.getByRole("button", { name: "90 min" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });

  it("Siguiente pide la rutina con los parámetros elegidos", async () => {
    const transport = vi.fn(replyWith(ROUTINE));
    renderWizard({ transport });

    fireEvent.click(screen.getByRole("radio", { name: "Definición" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir un día de entrenamiento" }));
    fireEvent.click(screen.getByRole("button", { name: "90 min" }));
    fireEvent.click(screen.getByText("Siguiente"));

    await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    const context = transport.mock.calls[0][1];
    expect(context.currentGoal).toBe("definition");
    expect(context.routineRequest.daysPerWeek).toBe(4);
    expect(context.routineRequest.sessionDurationMinutes).toBe(90);
    // The catalog travels as the allow-list, so the model cannot name outside it.
    expect(context.routineRequest.allowedExerciseIds).toEqual(["ex-press", "ex-fly", "ex-row"]);
  });
});

// ------------------------------------------------------------------- step 2

describe("RoutineGeneratorWizard · generando", () => {
  it("muestra el estado de espera con la etiqueta del asistente", async () => {
    // Definite assignment: the executor runs synchronously inside the constructor, so this
    // is set before the transport is ever awaited. TS cannot see that through the closure,
    // and would narrow the variable to `never`.
    let release!: () => void;
    const transport: RoutineTransport = () =>
      new Promise<AssistantResponse>((resolve) => {
        release = () => resolve({ message: JSON.stringify(ROUTINE) });
      });
    renderWizard({ transport });

    fireEvent.click(screen.getByText("Siguiente"));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Cronos está diseñando tu rutina");
    release();
  });

  it("Cancelar aborta la petición y vuelve a los parámetros", async () => {
    const signals: AbortSignal[] = [];
    const transport: RoutineTransport = (_instruction, _context, signal) => {
      if (signal) signals.push(signal);
      // Never resolves on its own: the point is that Cancel, not the model, ends this.
      return new Promise<AssistantResponse>(() => undefined);
    };
    renderWizard({ transport });

    fireEvent.click(screen.getByText("Siguiente"));
    await waitFor(() => expect(signals).toHaveLength(1));

    fireEvent.click(screen.getByText("Cancelar"));

    // Not "hidden": actually aborted, so the request stops instead of finishing into a
    // state nobody is looking at.
    expect(signals[0].aborted).toBe(true);
    await waitFor(() => expect(screen.getByText("Objetivo")).toBeTruthy());
  });

  it("un abort no se muestra como error", async () => {
    const transport: RoutineTransport = (_i, _c, signal) =>
      new Promise<AssistantResponse>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("cancelado", "AbortError"));
        });
      });
    renderWizard({ transport });

    fireEvent.click(screen.getByText("Siguiente"));
    await screen.findByText("Cancelar");
    fireEvent.click(screen.getByText("Cancelar"));

    // A cancelled generation the user asked for is not a failure to apologise for.
    await waitFor(() => expect(screen.queryByText("No se pudo generar la rutina.")).toBeNull());
  });

  it("muestra el error con un botón de reintento que vuelve a pedir la rutina", async () => {
    let attempts = 0;
    const transport: RoutineTransport = async () => {
      attempts += 1;
      if (attempts === 1) return { message: "No puedo diseñar eso." };
      return { message: JSON.stringify(ROUTINE) };
    };
    renderWizard({ transport });

    fireEvent.click(screen.getByText("Siguiente"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No se pudo generar la rutina.");

    fireEvent.click(screen.getByText("Reintentar"));

    await waitFor(() => expect(attempts).toBe(2));
    expect(await screen.findByDisplayValue("Pecho y espalda")).toBeTruthy();
  });
});

// ------------------------------------------------------------------- step 3

describe("RoutineGeneratorWizard · vista previa", () => {
  async function reachPreview(
    overrides: Parameters<typeof renderWizard>[0] = {},
    name = "Pecho y espalda",
  ) {
    const rendered = renderWizard(overrides);
    fireEvent.click(screen.getByText("Siguiente"));
    await screen.findByDisplayValue(name);
    return rendered;
  }

  it("muestra la rutina por días, con nombres y prescripciones", async () => {
    await reachPreview();

    expect(screen.getByText("Día 1")).toBeTruthy();
    expect(screen.getByText("Día 2")).toBeTruthy();
    expect(screen.getByText("Press de banca")).toBeTruthy();
    expect(screen.getByText("4×8–10")).toBeTruthy();
    // Equal ends collapse to one number rather than reading "8–8".
    expect(screen.getByText("3×12")).toBeTruthy();
  });

  it("deja renombrar la rutina sin tocar los ejercicios", async () => {
    const { props } = await reachPreview();
    const field = screen.getByDisplayValue("Pecho y espalda");

    fireEvent.change(field, { target: { value: "Upper 4 días" } });

    expect((field as HTMLInputElement).value).toBe("Upper 4 días");
    // The rename is local until the save: no request, and the day list is unchanged.
    expect(screen.getByText("Press de banca")).toBeTruthy();
    expect(props.save).not.toHaveBeenCalled();
  });

  it("Guardar entrega la rutina al almacén y confirma", async () => {
    const save = okSave();
    const onSaved = vi.fn();
    await reachPreview({ save, onSaved });

    fireEvent.click(screen.getByText("Guardar rutina"));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    // The whole routine, renamed or not -- the save is the only thing that touches storage.
    expect(save.mock.calls[0][1]).toMatchObject({ name: "Pecho y espalda" });
    expect(save.mock.calls[0][0]).toBe("u1");
    expect(await screen.findByText("Rutina guardada.")).toBeTruthy();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("informa cuando el guardado falla y no finge éxito", async () => {
    await reachPreview({ save: failingSave() });

    fireEvent.click(screen.getByText("Guardar rutina"));

    expect(await screen.findByText("No se pudo guardar la rutina.")).toBeTruthy();
    expect(screen.queryByText("Rutina guardada.")).toBeNull();
  });

  it("no vuelve a guardar una rutina ya guardada", async () => {
    const save = okSave();
    await reachPreview({ save });

    fireEvent.click(screen.getByText("Guardar rutina"));
    await screen.findByText("Rutina guardada.");
    const button = screen.getByText("Guardar rutina").closest("button");
    fireEvent.click(button as HTMLButtonElement);

    // A double tap on a write that has already landed is a duplicate routine in the list.
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("Regenerar vuelve al paso dos y conserva los parámetros", async () => {
    const transport = vi.fn(replyWith(ROUTINE));
    await reachPreview({ transport });

    fireEvent.click(screen.getByText("Regenerar"));

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(transport).toHaveBeenCalledTimes(2);
    // Same four choices, without going back to the form: re-typing them to get a
    // different answer is how people give up on a feature.
    const context = transport.mock.calls[1][1];
    expect(context.currentGoal).toBe("volume");
    expect(context.routineRequest.daysPerWeek).toBe(3);
  });

  it("Volver a los parámetros deja la generación a la vista y conserva lo elegido", async () => {
    await reachPreview();

    fireEvent.click(screen.getByText("← Editar parámetros"));

    expect(await screen.findByText("Objetivo")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Mantenimiento" }));
    expect(screen.getByRole("radio", { name: "Mantenimiento" }).getAttribute("aria-checked")).toBe("true");
  });

  it("avisa cuando un ejercicio no se pudo resolver", async () => {
    const withUnknown = {
      name: "Con hueco",
      days: [
        {
          dayNumber: 1,
          focus: "",
          // A real-shaped id that is in no catalog and that nothing can stand in for.
          // An *empty* id would never get this far -- the validator refuses one before a
          // routine exists -- so the unresolved state is reachable only this way.
          exercises: [{ exerciseId: "inventada", sets: 4, repsMin: 8, repsMax: 10, restSeconds: 90 }],
        },
      ],
    };
    await reachPreview({ transport: replyWith(withUnknown), catalog: [] }, "Con hueco");

    expect(screen.getByText("Ejercicio no disponible")).toBeTruthy();
    // Refused rather than attempted: an unresolved id is a dangling foreign key.
    expect((screen.getByText("Guardar rutina").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

// A local `within` so this file does not depend on the whole-testing-library import surface.
function within(element: HTMLElement) {
  return {
    getAllByRole: (role: string) =>
      Array.from(element.querySelectorAll(`[role="${role}"]`)) as HTMLElement[],
  };
}