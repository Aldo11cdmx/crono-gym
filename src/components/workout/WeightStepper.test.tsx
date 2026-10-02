/**
 * @vitest-environment jsdom
 *
 * `WeightStepper` is where a wrong number becomes a wrong habit: it tells someone
 * what to load, and if it suggests a weight this gym cannot load they find out at
 * the rack. So the bulk of this file is not about layout but about the promise the
 * component makes -- every value it offers comes from the official 2.5/5/10/15/20
 * plate scale, and every step lands on a loadable weight.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WeightStepper, smallestPlate, type WeightStepperProps } from "./WeightStepper";
import { GYM_INVENTORY, GYM_SETTINGS_KEY, GymSettingsProvider } from "@/context/GymSettingsContext";
import { BAR_WEIGHTS, calculatePlates } from "@/lib/workout/weightUtils";

/**
 * Cleared between tests, not just cleaned up: the provider reads `localStorage` on
 * mount, so a test that switches to imperial units or enables change plates leaks
 * a different rack into every test that renders after it.
 */
beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

/** Renders inside the provider so the stepper sees the gym's real rack. */
function renderStepper(props: Omit<WeightStepperProps, "onChange"> = { value: 100 }) {
  const onChange = vi.fn();
  const utils = render(
    <GymSettingsProvider>
      <WeightStepper {...props} onChange={onChange} />
    </GymSettingsProvider>,
  );
  return { ...utils, onChange };
}

/** The plate breakdown line, as the user reads it. */
function platesText(): string {
  return screen.getByText(/Discos por lado/).textContent ?? "";
}

/** The editable field. */
function field(): HTMLInputElement {
  return screen.getByLabelText(/^Peso:/) as HTMLInputElement;
}

const plus = () => screen.getByLabelText("Subir peso");
const minus = () => screen.getByLabelText("Bajar peso");

/**
 * Types into the field and leaves it.
 *
 * `focusOut`, not `blur`: React has listened for `focusout` rather than `blur`
 * since v17, so `fireEvent.blur` dispatches an event React never sees and the
 * assertion silently tests nothing.
 */
function commitField(text: string) {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.focusOut(field());
}

describe("smallestPlate", () => {
  it("finds the smallest size in the rack", () => {
    expect(smallestPlate(GYM_INVENTORY)).toBe(2.5);
  });

  it("ignores a size present with zero pairs", () => {
    expect(smallestPlate({ 20: 2, 15: 0, 10: 2 })).toBe(10);
  });

  it("returns null for an empty rack", () => {
    expect(smallestPlate({})).toBeNull();
  });
});

describe("WeightStepper stepping", () => {
  it("steps by twice the smallest plate, because plates load per side", () => {
    // 2.5 kg is the smallest plate, so one press moves the bar 5 kg.
    const { onChange } = renderStepper({ value: 100 });
    fireEvent.click(plus());
    expect(onChange).toHaveBeenCalledWith(105);
  });

  it("steps down by the same amount", () => {
    const { onChange } = renderStepper({ value: 100 });
    fireEvent.click(minus());
    expect(onChange).toHaveBeenCalledWith(95);
  });

  it("only ever lands on a weight the rack can build", () => {
    // Walks a wide sweep, because the top of the range is where a naive
    // `value + step` produces weights that do not exist.
    let value = 20;
    for (let press = 0; press < 20; press += 1) {
      const onChange = vi.fn();
      const { unmount } = render(
        <GymSettingsProvider>
          <WeightStepper value={value} onChange={onChange} />
        </GymSettingsProvider>,
      );
      fireEvent.click(plus());
      const next = onChange.mock.calls[0]?.[0];
      unmount();
      if (next === undefined) break;
      const check = calculatePlates(next, BAR_WEIGHTS.olympic, GYM_INVENTORY);
      expect(check.isExact, `${next} kg is not loadable`).toBe(true);
      value = next;
    }
    expect(value).toBeGreaterThan(80);
  });

  it("does not call onChange when the step would not move", () => {
    const { onChange } = renderStepper({ value: 100, max: 100 });
    fireEvent.click(plus());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the down button at min", () => {
    renderStepper({ value: 20, min: 20 });
    expect((minus() as HTMLButtonElement).disabled).toBe(true);
    expect((plus() as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables both buttons when disabled", () => {
    renderStepper({ value: 100, disabled: true });
    expect((plus() as HTMLButtonElement).disabled).toBe(true);
    expect((minus() as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not step when disabled", () => {
    const { onChange } = renderStepper({ value: 100, disabled: true });
    fireEvent.click(plus());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps to max", () => {
    const { onChange } = renderStepper({ value: 100, max: 102.5 });
    fireEvent.click(plus());
    expect(onChange).toHaveBeenCalledWith(102.5);
  });
});

describe("WeightStepper the official plate scale", () => {
  it("prints only 2.5, 5, 10, 15 and 20 kg plates", () => {
    // 60 kg on a 20 kg bar is 20 per side: exactly one 20, nothing exotic.
    renderStepper({ value: 60 });
    expect(platesText()).toContain("1 × 20");
  });

  it("builds 100 kg from two 20s and a 15 per side", () => {
    // Greedy heaviest-first: 25 is not in this gym's inventory, so 20+20 wins.
    renderStepper({ value: 100 });
    expect(platesText()).toContain("2 × 20");
    expect(platesText()).not.toMatch(/25|1\.25|0\.5/);
  });

  it("never names a plate the gym does not stock", () => {
    // A rack with change plates enabled is the only way to see 1.25 here, and
    // even then the breakdown must not invent a 25.
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ useHalfPlates: true, inventory: { ...GYM_INVENTORY, 1.25: 2, 0.5: 2 } }),
    );
    renderStepper({ value: 62.5 });
    expect(platesText()).not.toMatch(/25(?![ ×])/);
    expect(platesText()).not.toContain("0.5");
  });

  it("says so when the bar is carrying nothing but itself", () => {
    renderStepper({ value: BAR_WEIGHTS.olympic });
    expect(platesText()).toContain("Solo la barra");
  });
});

describe("WeightStepper shortfall", () => {
  it("warns when the requested weight cannot be built exactly", () => {
    // 20 bar + 21.25 per side needs a 1.25 this gym does not have.
    renderStepper({ value: 62.5 });
    expect(platesText()).toContain("1 × 20");
    // 62.5 lands on 60 with 2.5 kg left on the rack.
    expect(screen.getByText(/Faltan/).textContent).toContain("2.5");
  });

  it("says nothing when the weight is exact", () => {
    renderStepper({ value: 100 });
    expect(screen.queryByText(/Faltan/)).toBeNull();
  });
});

describe("WeightStepper typing", () => {
  it("shows the value as kg by default", () => {
    renderStepper({ value: 100 });
    expect(field().value).toBe("100");
  });

  it("keeps a half-typed entry instead of rounding it away", () => {
    // The whole reason `SetEntry.weight` is a string. Typing "8" must not snap
    // back to 10 while the user is still on their way to 82.5.
    renderStepper({ value: 80 });
    fireEvent.change(field(), { target: { value: "8" } });
    expect(field().value).toBe("8");
  });

  it("commits on blur, snapped to something loadable", () => {
    const { onChange } = renderStepper({ value: 100 });
    // 82 kg is 31 per side, and this gym's smallest step is 2.5 per side, so the
    // nearest real weight is 80 -- not the 82 that was typed.
    commitField("82");
    expect(onChange).toHaveBeenCalledWith(80);
  });

  it("commits on Enter", () => {
    const { onChange } = renderStepper({ value: 100 });
    fireEvent.change(field(), { target: { value: "105" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(105);
  });

  it("accepts a decimal comma", () => {
    // The soft keyboard on iOS offers a comma in es-ES locales. A value that NaN
    // would parse as proves the comma was understood rather than swallowed.
    const { onChange } = renderStepper({ value: 100 });
    commitField("105,0");
    expect(onChange).toHaveBeenCalledWith(105);
  });

  it("keeps the previous value when the field is emptied", () => {
    const { onChange } = renderStepper({ value: 100 });
    commitField("");
    expect(onChange).not.toHaveBeenCalled();
    expect(field().value).toBe("100");
  });

  it("steps with the arrow keys, the way a native number input would", () => {
    const { onChange } = renderStepper({ value: 100 });
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(onChange).toHaveBeenNthCalledWith(1, 105);
    expect(onChange).toHaveBeenNthCalledWith(2, 95);
  });

  it("exposes spinbutton semantics, since it is not a number input", () => {
    renderStepper({ value: 100, min: 20, max: 200 });
    const input = field();
    expect(input.getAttribute("role")).toBe("spinbutton");
    expect(input.getAttribute("aria-valuenow")).toBe("100");
    expect(input.getAttribute("aria-valuemin")).toBe("20");
    expect(input.getAttribute("aria-valuemax")).toBe("200");
    // The keypad still has to be the numeric one.
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });
});

describe("WeightStepper suggestions", () => {
  it("offers the suggestion as a chip", () => {
    renderStepper({ value: 100, suggestedKg: 102.5 });
    expect(screen.getByText(/Sugerido 102\.5 kg/)).toBeTruthy();
  });

  it("applies the suggestion when tapped", () => {
    const { onChange } = renderStepper({ value: 100, suggestedKg: 102.5 });
    fireEvent.click(screen.getByLabelText("Usar el peso sugerido de 102.5 kg"));
    expect(onChange).toHaveBeenCalledWith(102.5);
  });

  it("hides the chip when the suggestion is the current weight", () => {
    renderStepper({ value: 100, suggestedKg: 100 });
    expect(screen.queryByText(/Sugerido/)).toBeNull();
  });

  it("shows why the engine is suggesting it", () => {
    renderStepper({
      value: 100,
      suggestedKg: 102.5,
      suggestionReason: "Subiste las 5 reps con RIR 2",
    });
    expect(screen.getByText("Subiste las 5 reps con RIR 2")).toBeTruthy();
  });
});

describe("WeightStepper previous set", () => {
  it("shows last session's weight and reps", () => {
    renderStepper({ value: 100, previousKg: 95, previousReps: 5 });
    expect(screen.getByText("95 × 5")).toBeTruthy();
  });

  it("omits the reference when there is no previous set", () => {
    renderStepper({ value: 100 });
    // Specific on purpose: the plate breakdown also contains a multiplication
    // sign ("2 × 20"), so `/×/` would match the wrong thing entirely.
    expect(screen.queryByText("95 × 5")).toBeNull();
    expect(screen.queryByRole("button", { name: /Repetir/ })).toBeNull();
  });

  it("converts the previous weight to the user's unit", () => {
    window.localStorage.setItem(GYM_SETTINGS_KEY, JSON.stringify({ weightUnit: "lb" }));
    renderStepper({ value: 100, previousKg: 100, previousReps: 5 });
    // 100 kg is 220.5 lb, not 100 lb -- an imperial user must never be handed
    // a pound figure that is really a kilogram one.
    expect(screen.getByText("220.5 × 5")).toBeTruthy();
    expect(field().value).toBe("220.5");
  });

  describe("as a one-tap autofill", () => {
    it("is a button once the caller supplies an apply handler", () => {
      renderStepper({
        value: 100,
        previousKg: 95,
        previousReps: 5,
        onApplyPrevious: vi.fn(),
      });
      expect(
        screen.getByLabelText("Repetir la última vez: 95 kilos por 5 repeticiones"),
      ).toBeTruthy();
    });

    it("hands over the previous weight and reps in one tap", () => {
      const onApplyPrevious = vi.fn();
      renderStepper({
        value: 100,
        previousKg: 95,
        previousReps: 5,
        onApplyPrevious,
      });
      fireEvent.click(
        screen.getByLabelText("Repetir la última vez: 95 kilos por 5 repeticiones"),
      );
      expect(onApplyPrevious).toHaveBeenCalledWith(95, 5);
    });

    it("snaps the previous weight onto the rack before handing it over", () => {
      // 97 kg is 38.5 per side, which the official scale can build; 82 cannot.
      const onApplyPrevious = vi.fn();
      renderStepper({ value: 100, previousKg: 82, previousReps: 5, onApplyPrevious });
      fireEvent.click(
        screen.getByLabelText("Repetir la última vez: 82 kilos por 5 repeticiones"),
      );
      expect(onApplyPrevious).toHaveBeenCalledWith(80, 5);
    });

    it("stays a plain caption when nothing can apply it", () => {
      // A button the user can tap that does nothing is worse than no button.
      renderStepper({ value: 100, previousKg: 95, previousReps: 5 });
      expect(screen.queryByRole("button", { name: /Repetir/ })).toBeNull();
      expect(screen.getByText("95 × 5")).toBeTruthy();
    });

    it("names itself without the rep count when reps are unknown", () => {
      renderStepper({
        value: 100,
        previousKg: 95,
        onApplyPrevious: vi.fn(),
      });
      expect(screen.getByLabelText("Repetir el peso de la última vez: 95 kilos")).toBeTruthy();
    });

    it("reports a null rep count rather than a fake zero", () => {
      const onApplyPrevious = vi.fn();
      renderStepper({ value: 100, previousKg: 95, onApplyPrevious });
      fireEvent.click(screen.getByLabelText("Repetir el peso de la última vez: 95 kilos"));
      // Zero reps would overwrite the row's reps with "0".
      expect(onApplyPrevious).toHaveBeenCalledWith(95, null);
    });
  });

  it("commits an imperial entry back into kg", () => {
    window.localStorage.setItem(GYM_SETTINGS_KEY, JSON.stringify({ weightUnit: "lb" }));
    const { onChange } = renderStepper({ value: 45.36 });
    commitField("225");
    expect(onChange).toHaveBeenCalled();
    // 225 lb is 102.06 kg; the rack answers with the nearest real load.
    expect(onChange.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(100);
    expect(onChange.mock.calls[0]?.[0]).toBeLessThanOrEqual(105);
  });
});

describe("WeightStepper warm-up ramp", () => {
  it("offers 40/60/80 percent, snapped to the official scale", () => {
    renderStepper({ value: 100 });
    for (const weight of [40, 60, 80]) {
      expect(screen.getByLabelText(`Cargar el calentamiento de ${weight} kg`)).toBeTruthy();
    }
  });

  it("only offers ramp steps the gym can load", () => {
    renderStepper({ value: 85 });
    const chips = screen.getAllByLabelText(/Cargar el calentamiento de/);
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      const kg = Number(/de ([\d.]+) kg/.exec(chip.getAttribute("aria-label") ?? "")?.[1]);
      expect(calculatePlates(kg, BAR_WEIGHTS.olympic, GYM_INVENTORY).isExact, `${kg} kg`).toBe(
        true,
      );
    }
  });

  it("loads the warm-up when tapped", () => {
    const { onChange } = renderStepper({ value: 100 });
    fireEvent.click(screen.getByLabelText("Cargar el calentamiento de 60 kg"));
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it("offers no ramp at or below the empty bar", () => {
    // 40/60/80 percent of the bar is the bar, three times.
    renderStepper({ value: BAR_WEIGHTS.olympic });
    expect(screen.queryByText("Rampa de calentamiento")).toBeNull();
  });
});

describe("WeightStepper bar awareness", () => {
  it("reads the bar from settings when no barType prop is given", () => {
    window.localStorage.setItem(GYM_SETTINGS_KEY, JSON.stringify({ barType: "standard" }));
    // 50 kg on a 15 kg bar is 17.5 per side = 15 + 2.5.
    renderStepper({ value: 50 });
    expect(platesText()).toContain("1 × 15");
  });

  it("lets the barType prop override the rack", () => {
    window.localStorage.setItem(GYM_SETTINGS_KEY, JSON.stringify({ barType: "olympic" }));
    renderStepper({ value: 50, barType: "standard" });
    expect(platesText()).toContain("1 × 15");
  });

  it("keeps every stepped weight loadable across bar types", () => {
    for (const barType of ["olympic", "standard", "ez", "hex"] as const) {
      const onChange = vi.fn();
      const { unmount } = render(
        <GymSettingsProvider>
          <WeightStepper value={BAR_WEIGHTS[barType] + 20} onChange={onChange} barType={barType} />
        </GymSettingsProvider>,
      );
      fireEvent.click(plus());
      const next = onChange.mock.calls[0]?.[0];
      unmount();
      expect(next, `${barType} did not step`).toBeDefined();
      expect(
        calculatePlates(next ?? 0, BAR_WEIGHTS[barType], GYM_INVENTORY).isExact,
        `${barType} -> ${next} kg`,
      ).toBe(true);
    }
  });
});

describe("WeightStepper accessibility", () => {
  it("names both buttons and the field", () => {
    renderStepper({ value: 100 });
    expect(plus()).toBeTruthy();
    expect(minus()).toBeTruthy();
    expect(field().getAttribute("aria-label")).toBe("Peso: 100 kg");
  });

  it("hides decorative icons from the accessibility tree", () => {
    const { container } = renderStepper({ value: 100 });
    // The buttons are named by their aria-label, so a second name from the icon
    // would only add noise.
    expect(container.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);
  });

  it("keeps the tap targets at the WCAG 2.5.5 minimum", () => {
    renderStepper({ value: 100 });
    for (const button of [plus(), minus()]) {
      expect(button.style.minWidth).toBe("44px");
      expect(button.style.minHeight).toBe("44px");
    }
  });

  it("groups the control under a single name", () => {
    renderStepper({ value: 100 });
    expect(screen.getByRole("group", { name: "Peso" })).toBeTruthy();
  });
});
