/**
 * @vitest-environment jsdom
 *
 * `SetLoggerRow` used to carry its own table of Tailwind colour classes, including
 * a green for a load increase that `tokens.ts` explicitly documents as excluded
 * from this product because a deuteranope folds it into the deload amber one card
 * below. So this file asserts behaviour *and* that the colours come from the
 * token table, because the regression that matters here is silent: nothing breaks,
 * the advice just stops being readable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SetLoggerRow } from "./SetLoggerRow";
import { GymSettingsProvider } from "../context/GymSettingsContext";
import { SET_TYPE_LABELS } from "../lib/i18n";
import { SET_KINDS, type SetKind } from "../lib/workout/setKind";
import type { SetEntry } from "../lib/workout/types";
import type { OverloadTarget } from "../lib/overload";
import { STATUS } from "../design/tokens";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

function entry(overrides: Partial<SetEntry> = {}): SetEntry {
  return {
    set_number: 1,
    weight: "",
    reps: "",
    rpe: "",
    kind: "normal",
    completed: false,
    ...overrides,
  };
}

function renderRow(props: Partial<Parameters<typeof SetLoggerRow>[0]> = {}) {
  const onChange = vi.fn();
  const onRemove = vi.fn();
  const onDuplicate = vi.fn();
  const view = render(
    <GymSettingsProvider>
      <SetLoggerRow
        entry={entry({ weight: "100", reps: "5" })}
        index={0}
        onChange={onChange}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        {...props}
      />
    </GymSettingsProvider>,
  );
  return { ...view, onChange, onRemove, onDuplicate };
}

/** The overload engine's "go heavier" verdict. */
const INCREASE: OverloadTarget = {
  decision: "increase",
  weight: 105,
  reps: 5,
  delta: "+5 kg",
  reason: "Subiste las 5 reps con RIR 2",
  estimateConfident: true,
  repRange: { min: 5, max: 8 },
  incrementKg: 5,
};

const DELOAD: OverloadTarget = { ...INCREASE, decision: "deload", weight: 85, delta: "-15 kg" };

describe("SetLoggerRow set types", () => {
  it("offers all four kinds", () => {
    renderRow();
    for (const kind of SET_KINDS) {
      expect(screen.getByText(SET_TYPE_LABELS[kind])).toBeTruthy();
    }
  });

  it("marks the current kind as pressed and the rest as not", () => {
    renderRow({ entry: entry({ kind: "drop" }) });
    for (const kind of SET_KINDS) {
      const chip = screen.getByRole("button", { name: `Serie 1 de tipo ${SET_TYPE_LABELS[kind]}` });
      expect(chip.getAttribute("aria-pressed"), kind).toBe(String(kind === "drop"));
    }
  });

  it("changes the kind on tap", () => {
    const { onChange } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Serie 1 de tipo Al fallo" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "failure" }));
  });

  it.each(SET_KINDS)("keeps every other field when switching to %s", (kind: SetKind) => {
    const { onChange } = renderRow({ entry: entry({ weight: "80", reps: "6", rpe: "9" }) });
    fireEvent.click(screen.getByRole("button", { name: `Serie 1 de tipo ${SET_TYPE_LABELS[kind]}` }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weight: "80", reps: "6", rpe: "9", kind }),
    );
  });

  it("groups the chips under one accessible name", () => {
    renderRow();
    expect(screen.getByRole("group", { name: "Tipo de serie" })).toBeTruthy();
  });
});

describe("SetLoggerRow weight stepper", () => {
  it("renders the WeightStepper, not a bare input", () => {
    renderRow();
    expect(screen.getByRole("spinbutton", { name: /Peso: 100 kg/ })).toBeTruthy();
  });

  it("steps the weight by the rack's smallest plate pair", () => {
    renderRow({ entry: entry({ weight: "100" }) });
    fireEvent.click(screen.getByLabelText("Subir peso"));
    // 5 kg per side-loadable press on the official 2.5/5/10/15/20 scale.
    expect(screen.getByLabelText("Subir peso")).toBeTruthy();
  });

  it("writes the stepped weight back as a string", () => {
    const { onChange } = renderRow({ entry: entry({ weight: "100" }) });
    fireEvent.click(screen.getByLabelText("Subir peso"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ weight: "105" }));
  });

  it("prints the plate breakdown from the gym's official scale", () => {
    renderRow({ entry: entry({ weight: "100" }) });
    expect(screen.getByText(/Discos por lado/).textContent).toContain("2 × 20");
  });

  it("shows the previous session as a one-tap autofill on the row it belongs to", () => {
    renderRow({ previousKg: 95, previousReps: 5 });
    expect(
      screen.getByLabelText("Repetir la última vez: 95 kilos por 5 repeticiones"),
    ).toBeTruthy();
  });

  it("fills weight and reps from the previous session in one tap", () => {
    // Re-typing the same two numbers for the opening set of every session is
    // the most repeated piece of typing in the whole logger.
    const { onChange } = renderRow({ previousKg: 95, previousReps: 5 });
    fireEvent.click(
      screen.getByLabelText("Repetir la última vez: 95 kilos por 5 repeticiones"),
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ weight: "95", reps: "5" }));
  });

  it("omits the previous reference when there is none", () => {
    renderRow();
    expect(screen.queryByText("95 × 5")).toBeNull();
    expect(screen.queryByRole("button", { name: /Repetir/ })).toBeNull();
  });
});

describe("SetLoggerRow suggestion", () => {
  it("passes the engine's weight and reason to the stepper", () => {
    renderRow({ suggestion: INCREASE });
    expect(screen.getByText(/Sugerido 105 kg/)).toBeTruthy();
    expect(screen.getByText("Subiste las 5 reps con RIR 2")).toBeTruthy();
  });

  it("applies the weight *and* the rep count together", () => {
    // Weight alone would leave the row claiming 5 reps while the engine meant 8.
    const { onChange } = renderRow({ suggestion: { ...INCREASE, reps: 8 } });
    fireEvent.click(screen.getByLabelText("Usar el peso sugerido de 105 kg"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ weight: "105", reps: "8" }),
    );
  });

  it("shows the delta as its own chip", () => {
    renderRow({ suggestion: INCREASE });
    expect(screen.getByText(/Ajuste \+5 kg/)).toBeTruthy();
  });

  it("warns when the estimated 1RM is not trustworthy", () => {
    renderRow({ suggestion: { ...INCREASE, estimateConfident: false } });
    expect(screen.getByText(/1RM estimado no es fiable/)).toBeTruthy();
  });

  it("says nothing about a first-time movement", () => {
    renderRow({ suggestion: { ...INCREASE, decision: "first_time", weight: null } });
    expect(screen.queryByText(/Ajuste/)).toBeNull();
    expect(screen.queryByText(/Sugerido/)).toBeNull();
  });
});

describe("SetLoggerRow row actions", () => {
  it("removes on tap", () => {
    const { onRemove } = renderRow();
    fireEvent.click(screen.getByLabelText("Eliminar la serie 1"));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("duplicates on tap", () => {
    const { onDuplicate } = renderRow();
    fireEvent.click(screen.getByLabelText("Duplicar la serie 1"));
    expect(onDuplicate).toHaveBeenCalledOnce();
  });

  it("names the buttons by set number", () => {
    renderRow({ index: 2 });
    expect(screen.getByLabelText("Eliminar la serie 3")).toBeTruthy();
    expect(screen.getByLabelText("Duplicar la serie 3")).toBeTruthy();
  });

  it("toggles completion", () => {
    const { onChange } = renderRow({ entry: entry({ completed: false }) });
    fireEvent.click(screen.getByRole("button", { name: "Marcar la serie 1 como completada" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ completed: true }));
  });

  it("offers to un-complete a completed set", () => {
    renderRow({ entry: entry({ completed: true }) });
    expect(
      screen.getByRole("button", { name: "Marcar la serie 1 como no completada" }),
    ).toBeTruthy();
  });

  it("keeps the warm-up kind when completing, so it still excludes itself", () => {
    // Toggling completion must not silently promote a warm-up to a working set.
    const { onChange } = renderRow({ entry: entry({ kind: "warmup" }) });
    fireEvent.click(screen.getByRole("button", { name: "Marcar la serie 1 como completada" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "warmup" }));
  });

  it("edits reps and RPE independently", () => {
    const { onChange } = renderRow();
    fireEvent.change(screen.getByLabelText("Repeticiones"), { target: { value: "8" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ reps: "8" }));
    fireEvent.change(screen.getByLabelText("RPE"), { target: { value: "9" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rpe: "9" }));
  });
});

describe("SetLoggerRow colour hygiene", () => {
  it("takes the increase tone from the token table, never a green class", () => {
    const { container } = renderRow({ suggestion: INCREASE });
    const html = container.innerHTML;
    // `STATUS.progression` is cyan for exactly this reason.
    expect(html).toContain(STATUS.progression.border);
    expect(html).not.toMatch(/emerald|green-\d|text-green/);
  });

  it("takes the deload tone from the token table", () => {
    const { container } = renderRow({ suggestion: DELOAD });
    expect(container.innerHTML).toContain(STATUS.warning.border);
    expect(container.innerHTML).not.toMatch(/amber-\d/);
  });

  it("keeps increase and deload visually distinct", () => {
    // The reason `progression` is cyan rather than green: a deuteranope folds
    // green into the amber sitting one card below.
    expect(STATUS.progression.border).not.toBe(STATUS.warning.border);
  });

  it("uses no arbitrary-hue Tailwind class anywhere in the row", () => {
    const { container } = renderRow({ suggestion: INCREASE });
    const classNames = [...container.querySelectorAll("[class]")]
      .map((node) => node.getAttribute("class") ?? "")
      .join(" ");
    expect(classNames).not.toMatch(
      /(emerald|sky|amber|red|rose|violet|green|blue|indigo)-(\d{2,3})/,
    );
  });

  it("gives a hold verdict no status colour at all", () => {
    // "Maintain the load" is the absence of news and should look like it.
    const { container } = renderRow({ suggestion: { ...INCREASE, decision: "hold" } });
    expect(container.innerHTML).not.toContain(STATUS.progression.border);
    expect(container.innerHTML).not.toContain(STATUS.warning.border);
  });

  it("marks a completed set with the success token", () => {
    const { container } = renderRow({ entry: entry({ completed: true }) });
    expect(container.innerHTML).toContain(STATUS.success.muted);
  });
});
