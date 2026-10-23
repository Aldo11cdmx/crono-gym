/**
 * @vitest-environment jsdom
 *
 * `GymSettingsPanel` is where the rack is described, so every field in it is a
 * number the weight stepper will later multiply by two and present to someone as
 * loadable. The failures worth pinning are therefore not cosmetic: a counter that
 * accepts five pairs, a bar weight that goes negative, a preview that disagrees
 * with the counters above it, or a half-plate toggle that leaves phantom 1.25s on
 * the rack after it is switched back off.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GymSettingsPanel } from "./GymSettingsPanel";
import {
  DEFAULT_GYM_SETTINGS,
  GYM_INVENTORY,
  GYM_PLATE_SCALE,
  GYM_SETTINGS_KEY,
  GymSettingsProvider,
  useGymSettings,
} from "@/context/GymSettingsContext";
import { GYM_LABELS } from "@/lib/i18n";
import { BAR_WEIGHTS } from "@/lib/workout/weightUtils";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

/** Renders the panel with a probe so tests can read what was persisted. */
function renderPanel() {
  let latest: ReturnType<typeof useGymSettings> | null = null;
  function Probe() {
    latest = useGymSettings();
    return null;
  }

  const onClose = () => {};
  const view = render(
    <GymSettingsProvider>
      <GymSettingsPanel onClose={onClose} />
      <Probe />
    </GymSettingsProvider>,
  );
  return {
    ...view,
    onClose,
    state: () => latest as unknown as ReturnType<typeof useGymSettings>,
    reload: () => {
      cleanup();
      return renderPanel().state();
    },
  };
}

/** The row for one plate size, for scoping its counters. */
function plateRow(size: number): HTMLElement {
  const row = screen.getByText(`${size} kg`).closest("li");
  if (!row) throw new Error(`no row for ${size}`);
  return row;
}

function addPair(size: number) {
  fireEvent.click(within(plateRow(size)).getByLabelText(GYM_LABELS.addPairAriaLabel(size)));
}

function removePair(size: number) {
  fireEvent.click(within(plateRow(size)).getByLabelText(GYM_LABELS.removePairAriaLabel(size)));
}

describe("GymSettingsPanel structure", () => {
  it("is a labelled modal dialog", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog", { name: GYM_LABELS.title });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("closes on demand", () => {
    let closed = false;
    render(
      <GymSettingsProvider>
        <GymSettingsPanel onClose={() => (closed = true)} />
      </GymSettingsProvider>,
    );
    fireEvent.click(screen.getByText(GYM_LABELS.done));
    expect(closed).toBe(true);
  });

  it("groups every control by name", () => {
    renderPanel();
    expect(screen.getByText(GYM_LABELS.barLabel)).toBeTruthy();
    expect(screen.getByText(GYM_LABELS.unitLabel)).toBeTruthy();
    expect(screen.getByText(GYM_LABELS.platesLabel)).toBeTruthy();
    expect(screen.getByLabelText(GYM_LABELS.previewLabel)).toBeTruthy();
  });
});

describe("GymSettingsPanel bar selector", () => {
  it("offers all five bar types", () => {
    renderPanel();
    for (const label of ["Olímpica", "Estándar", "EZ", "Hexagonal", "Propia"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("starts on the olympic bar", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Olímpica" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("switches bar and persists the choice", () => {
    const panel = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Hexagonal" }));
    expect(panel.state().barType).toBe("hex");
    expect(panel.reload().barType).toBe("hex");
  });

  it("states the selected bar's weight", () => {
    renderPanel();
    expect(screen.getByText(`Esta barra pesa ${BAR_WEIGHTS.olympic} kg.`)).toBeTruthy();
  });

  it("only asks for a custom weight when the custom bar is chosen", () => {
    renderPanel();
    expect(screen.queryByLabelText(GYM_LABELS.customBarLabel)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Propia" }));
    expect(screen.getByLabelText(GYM_LABELS.customBarLabel)).toBeTruthy();
  });

  it("persists a custom bar weight", () => {
    const panel = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Propia" }));
    fireEvent.change(screen.getByLabelText(GYM_LABELS.customBarLabel), {
      target: { value: "12.5" },
    });
    expect(panel.reload().customBarKg).toBe(12.5);
    expect(panel.reload().barKg).toBe(12.5);
  });

  it("refuses a negative or unparseable custom weight", () => {
    // NaN in settings would be multiplied by two and shown to a lifter.
    const panel = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Propia" }));
    fireEvent.change(screen.getByLabelText(GYM_LABELS.customBarLabel), { target: { value: "-" } });
    fireEvent.change(screen.getByLabelText(GYM_LABELS.customBarLabel), {
      target: { value: "-8" },
    });
    expect(panel.state().customBarKg).toBe(0);
  });
});

describe("GymSettingsPanel unit selector", () => {
  it("offers kg and lb", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "kg" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "lb" })).toBeTruthy();
  });

  it("persists the unit", () => {
    const panel = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "lb" }));
    expect(panel.reload().weightUnit).toBe("lb");
  });
});

describe("GymSettingsPanel plate inventory", () => {
  it("lists the official scale and nothing else", () => {
    renderPanel();
    for (const size of GYM_PLATE_SCALE) {
      expect(screen.getByText(`${size} kg`)).toBeTruthy();
    }
    // A 25 or a 1.25 here would let the stepper suggest loads this gym cannot
    // build.
    expect(screen.queryByText("25 kg")).toBeNull();
    expect(screen.queryByText("1.25 kg")).toBeNull();
  });

  it("starts from two pairs of each", () => {
    const panel = renderPanel();
    for (const size of GYM_PLATE_SCALE) {
      expect(plateRow(size).textContent, `${size}`).toContain("2");
    }
    expect(panel.state().inventory).toEqual(GYM_INVENTORY);
  });

  it("adds a pair on tap", () => {
    const panel = renderPanel();
    addPair(20);
    expect(panel.state().inventory[20]).toBe(3);
  });

  it("removes a pair on tap", () => {
    const panel = renderPanel();
    removePair(20);
    expect(panel.state().inventory[20]).toBe(1);
  });

  it("deletes the size entirely when the last pair goes", () => {
    // A stored zero is not the same as an absent key: the plate maths treats a
    // missing key as "none" and a zero as "none", but the payload should not
    // carry a meaningless row forever.
    const panel = renderPanel();
    removePair(2.5);
    removePair(2.5);
    expect(panel.state().inventory[2.5]).toBeUndefined();
  });

  it("cannot go below zero", () => {
    const panel = renderPanel();
    removePair(2.5);
    removePair(2.5);
    removePair(2.5);
    expect(panel.state().inventory[2.5]).toBeUndefined();
    expect((within(plateRow(2.5)).getByLabelText(GYM_LABELS.removePairAriaLabel(2.5)) as HTMLButtonElement).disabled).toBe(true);
  });

  it("stops at four pairs, the ceiling a plate tree can hold", () => {
    const panel = renderPanel();
    for (let i = 0; i < 8; i += 1) addPair(15);
    expect(panel.state().inventory[15]).toBe(4);
  });

  it("persists an edited inventory", () => {
    const panel = renderPanel();
    addPair(20);
    addPair(20);
    removePair(5);
    expect(panel.reload().inventory).toEqual({ ...GYM_INVENTORY, 20: 4, 5: 1 });
  });
});

describe("GymSettingsPanel half plates", () => {
  it("is off by default", () => {
    const panel = renderPanel();
    expect(panel.state().useHalfPlates).toBe(false);
    expect(screen.queryByText("1.25 kg")).toBeNull();
  });

  it("reveals the change plates when switched on", () => {
    renderPanel();
    fireEvent.click(screen.getByLabelText(GYM_LABELS.halfPlatesLabel));
    expect(screen.getByText("1.25 kg")).toBeTruthy();
    expect(screen.getByText("0.5 kg")).toBeTruthy();
  });

  it("takes them back off again, leaving no phantom plates", () => {
    const panel = renderPanel();
    fireEvent.click(screen.getByLabelText(GYM_LABELS.halfPlatesLabel));
    fireEvent.click(screen.getByLabelText(GYM_LABELS.halfPlatesLabel));
    expect(panel.reload().inventory).toEqual(GYM_INVENTORY);
  });

  it("counts the change plates in the inventory", () => {
    const panel = renderPanel();
    fireEvent.click(screen.getByLabelText(GYM_LABELS.halfPlatesLabel));
    expect(panel.state().inventory[1.25]).toBe(2);
    expect(panel.state().inventory[0.5]).toBe(2);
  });
});

describe("GymSettingsPanel bar preview", () => {
  it("summarises the bar and its configured plates", () => {
    renderPanel();
    expect(screen.getByText(/Barra de 20 kg con 2.5, 5, 10, 15, 20 kg por lado\./)).toBeTruthy();
  });

  it("says so when the bar carries nothing but itself", () => {
    const panel = renderPanel();
    for (const size of GYM_PLATE_SCALE) {
      removePair(size);
      removePair(size);
    }
    expect(screen.getByText(/Barra de 20 kg sin discos\./)).toBeTruthy();
    expect(panel.state().inventory).toEqual({});
  });

  it("follows the bar selector", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Hexagonal" }));
    expect(screen.getByText(/Barra de 18 kg con/)).toBeTruthy();
  });

  it("follows a custom bar weight", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Propia" }));
    fireEvent.change(screen.getByLabelText(GYM_LABELS.customBarLabel), {
      target: { value: "12.5" },
    });
    expect(screen.getByText(/Barra de 12.5 kg con/)).toBeTruthy();
  });

  it("draws both sides of the bar, so it reads as a symmetric load", () => {
    // One sleeve would be a picture of a half-bar. The sleeves themselves carry
    // `flex: 1` and no width, so only the plate rectangles are counted.
    const { container } = render(
      <GymSettingsProvider>
        <GymSettingsPanel onClose={() => {}} />
      </GymSettingsProvider>,
    );
    const preview = container.querySelector(`[aria-label="${GYM_LABELS.previewLabel}"]`);
    const plateRects = preview?.querySelectorAll("span[style*='width']") ?? [];
    expect(plateRects.length).toBe(GYM_PLATE_SCALE.length * 2);
  });

  it("drops a plate rectangle from both sides when a size runs out", () => {
    const { container } = render(
      <GymSettingsProvider>
        <GymSettingsPanel onClose={() => {}} />
      </GymSettingsProvider>,
    );
    const preview = () =>
      container.querySelector(`[aria-label="${GYM_LABELS.previewLabel}"]`);
    const plates = () => preview()?.querySelectorAll("span[style*='width']").length ?? 0;

    expect(plates()).toBe(GYM_PLATE_SCALE.length * 2);
    fireEvent.click(within(plateRow(2.5)).getByLabelText(GYM_LABELS.removePairAriaLabel(2.5)));
    fireEvent.click(within(plateRow(2.5)).getByLabelText(GYM_LABELS.removePairAriaLabel(2.5)));
    // Both 2.5s go, not just the one on the left.
    expect(plates()).toBe((GYM_PLATE_SCALE.length - 1) * 2);
  });

  it("orders the preview smallest first, so the stack reads outward", () => {
    renderPanel();
    const summary = screen.getByText(/por lado\./).textContent ?? "";
    const listed = summary
      .replace("Barra de 20 kg con ", "")
      .replace(" kg por lado.", "")
      .split(", ")
      .map(Number);
    expect(listed).toEqual([...listed].sort((a, b) => a - b));
  });
});

describe("GymSettingsPanel plate counters", () => {
  it("labels the unit over the counters, not in a caption above them", () => {
    // The ambiguity this resolves is a `2` next to `2.5 kg`: is that two plates,
    // or two on each end? A caption at the top of the section only ever
    // disambiguates the first row, so the label has to be a column header.
    renderPanel();
    const header = screen.getByText(GYM_LABELS.pairsColumnLabel);
    expect(header).toBeTruthy();
    // It sits in the header row, which is a sibling of the list, not inside any
    // one row -- the label describes the column, so no row may claim it.
    expect(header.closest("li")).toBeNull();
  });

  it("spells the unit on every counter, not just the header", () => {
    // The header is read once. The numbers are read on every tap, and `2 pares`
    // cannot be misread as two plates on the bar.
    const panel = renderPanel();
    for (const size of GYM_PLATE_SCALE) {
      expect(plateRow(size).textContent, `${size}`).toContain("2 pares");
    }
    removePair(10);
    expect(plateRow(10).textContent).toContain("1 par");
    expect(plateRow(10).textContent).not.toContain("1 pares");
    addPair(10);
    expect(panel.state().inventory[10]).toBe(2);
  });

  it("keeps the unit visible at zero, which is the row that needs it most", () => {
    // Zero is exactly the digit that reads as "no plates" or "no data"; a
    // bare `0` next to a plate size is the case the label exists for.
    renderPanel();
    removePair(20);
    removePair(20);
    expect(plateRow(20).textContent).toContain("0 pares");
  });
});

describe("GymSettingsPanel against the stored settings", () => {
  it("opens on whatever was last saved, not the defaults", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ barType: "standard", weightUnit: "lb", inventory: { 20: 3, 10: 1 } }),
    );
    const panel = renderPanel();
    expect(screen.getByRole("button", { name: "Estándar" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "lb" }).getAttribute("aria-pressed")).toBe("true");
    expect(panel.state().inventory).toEqual({ 20: 3, 10: 1 });
  });

  it("never narrows the plate scale below the official one", () => {
    // The stored inventory is the user's; the *scale* is the gym's. A saved
    // payload with an exotic size must not put a 25 on this list.
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ inventory: { 20: 2, 25: 4 } }),
    );
    renderPanel();
    expect(screen.queryByText("25 kg")).toBeNull();
    expect(DEFAULT_GYM_SETTINGS.inventory).not.toHaveProperty("25");
  });
});
