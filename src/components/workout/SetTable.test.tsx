/**
 * @vitest-environment jsdom
 *
 * SetTable.test.tsx — the numbers are the screen.
 *
 * Four claims worth protecting, each one a way this screen could quietly lie to an athlete
 * mid-set:
 *
 *   1. **The inputs are unbordered on purpose.** Outlined cells turn a table into a stack
 *      of cards on a phone. The absence is asserted, not just the presence of the fill.
 *   2. **Figures are mono and tabular.** A proportional digit changes width, so editing a
 *      weight shifts its own column under the athlete's finger.
 *   3. **The tick keeps its colour change under reduced motion.** The scale is the
 *      flourish; the colour is the information that the set was logged.
 *   4. **The kind chips stay.** They look like clutter, and they are: `kind` is what
 *      `finish()` reads for `is_warmup`, so a warm-up set that cannot be marked becomes
 *      volume and corrupts every later 1RM.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SetTable, type SetTableProps } from "./SetTable";
import { SET_LOGGER_LABELS, SET_TYPE_LABELS } from "../../lib/i18n";
import type { OverloadTarget } from "../../lib/overload";
import type { SetEntry } from "../../lib/workout/types";
import { sameColor } from "../../test-support/color";
import { ACCENT, GLASS, MOTION, NUMERIC, STATUS, SURFACE, TEXT, TYPE } from "../../design/tokens";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function set(over: Partial<SetEntry> = {}): SetEntry {
  return { set_number: 1, weight: "", reps: "", rpe: "", kind: "normal", completed: false, ...over };
}

const THREE = [set({ set_number: 1 }), set({ set_number: 2 }), set({ set_number: 3 })];

function renderTable(overrides: Partial<SetTableProps> = {}) {
  const props: SetTableProps = {
    sets: THREE,
    formatWeight: (kg) => String(kg),
    onChange: vi.fn(),
    onRemove: vi.fn(),
    onDuplicate: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  };
  const view = render(<SetTable {...props} />);
  return { ...view, props };
}

function row(n: number): HTMLElement {
  return screen.getByRole("group", { name: SET_LOGGER_LABELS.setNumber(n) });
}

/** The `Anterior` row, which is a caption rather than a labelled control. */
function previousRow(): HTMLElement {
  return screen.getByText("Anterior").closest("div")!;
}

function cell(row_: HTMLElement, label: string): HTMLInputElement {
  return within(row_).getByLabelText(label) as HTMLInputElement;
}

/** The set rows only. The kind chips are `role="group"` too, one per row. */
function setRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[role='group'][aria-label^='Serie']"),
  );
}

describe("the Anterior row", () => {
  it("appears when there is a previous set, and not when there is not", () => {
    const { unmount } = renderTable({ previousKg: 95, previousReps: 5 });
    expect(screen.getByText("Anterior")).toBeTruthy();
    unmount();

    renderTable({ previousKg: null });
    expect(screen.queryByText("Anterior")).toBeNull();
  });

  it("puts the weight and the reps in the same mono run", () => {
    renderTable({ previousKg: 95, previousReps: 5 });

    // One run, not "95" and "5" in separate cells: the pair is a single fact about a
    // single set, and splitting it invites reading the reps against the wrong weight.
    expect(previousRow().textContent).toContain("95 × 5");
  });

  it("says so when the reps were never recorded", () => {
    renderTable({ previousKg: 95, previousReps: null });

    // "95 ×" would read as a set with no reps rather than as a set nobody logged.
    expect(previousRow().textContent).toContain("sin repeticiones registradas");
  });

  it("is not interactive, because the tap target for it lives on the row below", () => {
    renderTable({ previousKg: 95, previousReps: 5 });

    // Two rows both offering "repeat last time" would be one too many, and two grey rows
    // that both look pressable is worse than one.
    expect(within(previousRow()).queryByRole("button")).toBeNull();
  });

  it("converts through the caller's formatter, not its own unit rule", () => {
    renderTable({
      previousKg: 92.5,
      previousReps: 5,
      formatWeight: (kg) => `${(kg * 2.20462).toFixed(1)} lb`,
    });

    // 92.5 is the reason this is a prop: a second conversion rule in this file would
    // disagree the first time somebody lifts a fractional load.
    expect(previousRow().textContent).toContain("203.9 lb × 5");
  });
});

describe("the column headings", () => {
  it("labels all three columns once, outside the rows", () => {
    const { container } = renderTable();

    // The cells are unbordered by design, and three identical unlabelled boxes in a row is
    // not a table, it is a row of boxes. Counted outside the set groups because each row
    // repeats "Peso" over its own cell.
    const headings = screen
      .getAllByText(/^(Peso|Reps|RPE)$/)
      .filter((el) => !el.closest("[role='group']"));
    expect(headings.map((el) => el.textContent)).toEqual(["Peso", "Reps", "RPE"]);
    expect(container).toBeTruthy();
  });
});

describe("the numeric cells", () => {
  it("draws no border on them", () => {
    renderTable();
    const input = cell(row(1), SET_LOGGER_LABELS.repsLabel);

    expect(input.style.border).toContain("transparent");
    // The fill is what separates them instead.
    expect(sameColor(input.style.background, SURFACE.elevated)).toBe(true);
  });

  it("uses the mono family and the tabular figures", () => {
    renderTable();
    const input = cell(row(1), SET_LOGGER_LABELS.repsLabel);

    // `NUMERIC.align`, not `NUMERIC.slant` or nothing: a proportional digit changes width,
    // so editing a weight would move its own column.
    expect(input.style.fontFamily).toBe(TYPE.mono.font);
    expect(input.style.fontVariantNumeric).toBe(NUMERIC.align);
  });

  it("keeps every cell the same height, so the rows stay on one baseline", () => {
    renderTable();

    const heights = new Set(
      screen.getAllByRole("spinbutton").map((el) => (el as HTMLElement).style.minHeight),
    );
    expect(heights).toEqual(new Set([MOTION.minTouchTarget]));
  });

  it("reports a typed value back by index", () => {
    const { props } = renderTable();
    fireEvent.change(cell(row(2), SET_LOGGER_LABELS.repsLabel), { target: { value: "8" } });

    // By index, not by set number: the caller holds the array and the two are only the
    // same thing until a set is deleted.
    expect(props.onChange).toHaveBeenCalledWith(1, expect.objectContaining({ reps: "8" }));
  });

  it("reads an unparseable weight as 0 rather than as NaN", () => {
    renderTable({ sets: [set({ weight: "abc" })] });
    const input = within(row(1)).getByRole("spinbutton", { name: /Peso:/ }) as HTMLInputElement;

    // `parseFloat("abc") || 0` is the guard. Without the `|| 0` the stepper renders "NaN"
    // in the field the athlete is looking at mid-set.
    expect(input.value).toBe("0");
  });
});

describe("the completion toggle", () => {
  it("reports the flip through onChange, not through local state", () => {
    const { props } = renderTable();
    fireEvent.click(
      within(row(1)).getByRole("button", {
        name: SET_LOGGER_LABELS.completeAriaLabel(1, false),
      }),
    );

    // Nothing here owns completion. `ActiveWorkout` does, because the autosave, the undo
    // window and the sync payload all have to see the same flip.
    expect(props.onChange).toHaveBeenCalledWith(0, expect.objectContaining({ completed: true }));
  });

  it("names the set in its label, so the button is unambiguous off-screen", () => {
    renderTable();

    expect(
      within(row(2)).getByRole("button", { name: SET_LOGGER_LABELS.completeAriaLabel(2, false) }),
    ).toBeTruthy();
  });

  it("offers the reverse action once the set is done", () => {
    renderTable({ sets: [set({ completed: true })] });
    const button = within(row(1)).getByRole("button", {
      name: SET_LOGGER_LABELS.completeAriaLabel(1, true),
    });

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toContain(SET_LOGGER_LABELS.completed);
  });

  it("sits at rest, smaller and dimmer, while the set is open", () => {
    renderTable();
    const tick = row(1).querySelector("[data-check]") as HTMLElement;

    // The uncompleted tick is a slot to fill, not a claim.
    expect(tick.dataset.check).toBe("off");
    expect(tick.style.transform).toBe("scale(0.6)");
  });

  it("sits at full size when the set is done", () => {
    renderTable({ sets: [set({ completed: true })] });
    const tick = row(1).querySelector("[data-check]") as HTMLElement;

    expect(tick.dataset.check).toBe("on");
    expect(tick.style.transform).toBe("scale(1)");
  });

  it("carries the spring animation, because it is a confirmation", () => {
    renderTable();
    const tick = row(1).querySelector("[data-check]") as HTMLElement;

    // `MOTION.spring` overshoots: the mark lands and settles rather than fading in place.
    expect(tick.className).toContain("cronos-set-check");
  });

  it("keeps the colour change when motion is reduced, because the colour is the fact", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;

    try {
      renderTable({ sets: [set({ completed: true })] });
      const button = within(row(1)).getByRole("button", {
        name: SET_LOGGER_LABELS.completeAriaLabel(1, true),
      });
      const tick = row(1).querySelector("[data-check]") as HTMLElement;

      // The scale is the thing that goes. The accent-to-success swap is the only signal
      // that says the set reached the payload, and dropping it would leave a completed set
      // looking open.
      expect(sameColor((button as HTMLElement).style.background, STATUS.success.muted)).toBe(true);
      expect(tick.className).not.toContain("cronos-set-check");
      expect(tick.style.transform).toBe("scale(1)");
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("the kind chips", () => {
  it("keeps them, because `kind` decides what counts as volume", () => {
    renderTable();

    expect(
      within(row(1)).getByRole("button", {
        name: SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS.warmup, 1),
      }),
    ).toBeTruthy();
  });

  it("reports the new kind against the right row", () => {
    const { props } = renderTable();
    fireEvent.click(
      within(row(2)).getByRole("button", {
        name: SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS.drop, 2),
      }),
    );

    expect(props.onChange).toHaveBeenCalledWith(1, expect.objectContaining({ kind: "drop" }));
  });

  it("marks the current kind as pressed rather than as selected", () => {
    renderTable();

    // `aria-pressed`, not a radio. A set can genuinely be unclassified, and a radiogroup
    // announces "one of these is chosen" before anyone has touched the row.
    const chip = within(row(1)).getByRole("button", {
      name: SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS.normal, 1),
    });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("fills the pressed chip with the accent, so the current kind is one glance", () => {
    renderTable();
    const chip = within(row(1)).getByRole("button", {
      name: SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS.normal, 1),
    });

    expect(sameColor((chip as HTMLElement).style.background, ACCENT.base)).toBe(true);
  });
});

describe("the row actions", () => {
  it("adds a set on demand", () => {
    const { props } = renderTable();
    fireEvent.click(screen.getByText("+ Agregar serie"));
    expect(props.onAdd).toHaveBeenCalled();
  });

  it("removes and duplicates by index, so a deleted row cannot shift the target", () => {
    const { props } = renderTable();

    fireEvent.click(within(row(2)).getByLabelText(SET_LOGGER_LABELS.removeAriaLabel(2)));
    fireEvent.click(within(row(3)).getByLabelText(SET_LOGGER_LABELS.duplicateAriaLabel(3)));

    // Index, not set number: the caller's array is the thing being edited, and the two
    // diverge the moment a middle row is deleted.
    expect(props.onRemove).toHaveBeenCalledWith(1);
    expect(props.onDuplicate).toHaveBeenCalledWith(2);
  });

  it("keeps the row controls quiet, so the numbers stay the loudest thing", () => {
    renderTable();
    const button = within(row(1)).getByLabelText(SET_LOGGER_LABELS.removeAriaLabel(1));

    expect(sameColor((button as HTMLElement).style.color, TEXT.tertiary)).toBe(true);
  });
});

describe("the completed row", () => {
  it("takes the success surface, so a logged set is visible at a glance", () => {
    const { container } = renderTable({
      sets: [set({ completed: true }), set({ set_number: 2 })],
    });

    const [done, open] = setRows(container);
    expect(sameColor(done.style.background, STATUS.success.muted)).toBe(true);
    expect(done.style.border).toContain(STATUS.success.border);
    expect(sameColor(open.style.background, GLASS.fill)).toBe(true);
  });
});

describe("the overload suggestion", () => {
  const suggestion: OverloadTarget = {
    decision: "increase",
    weight: 100,
    reps: 6,
    delta: "+2.5 kg",
    reason: "Subiste 5 kg en las últimas dos sesiones.",
    estimateConfident: true,
    repRange: { min: 6, max: 8 },
    incrementKg: 2.5,
  };

  it("renders the delta above the opening set", () => {
    renderTable({ suggestion });

    expect(within(row(1)).getByText(SET_LOGGER_LABELS.deltaChip("+2.5 kg"))).toBeTruthy();
  });

  it("never offers it on a set already completed", () => {
    renderTable({ suggestion, sets: [set({ completed: true }), set({ set_number: 2 })] });

    // Telling someone what to do about a set they just did is noise, and on a completed
    // set it is also impossible to act on.
    expect(screen.queryByText(SET_LOGGER_LABELS.deltaChip("+2.5 kg"))).toBeNull();
  });

  it("says nothing at all on a first-time exercise", () => {
    renderTable({ suggestion: { ...suggestion, decision: "first_time" } });

    // `first_time` means there is no history to have progressed from, so a "+2.5 kg" off
    // the floor would be invented rather than derived.
    expect(screen.queryByText(SET_LOGGER_LABELS.deltaChip("+2.5 kg"))).toBeNull();
  });

  it("carries the engine's own uncertainty rather than hiding it", () => {
    renderTable({ suggestion: { ...suggestion, estimateConfident: false } });
    expect(screen.getByText(SET_LOGGER_LABELS.lowConfidence)).toBeTruthy();
  });

  it("renders a null weight as no suggested load, not as a suggested zero", () => {
    // `OverloadTarget.weight` is `number | null`: the engine declines to suggest a load it
    // cannot justify, and a "0 kg" chip would be a recommendation to lift nothing.
    const { container } = renderTable({ suggestion: { ...suggestion, weight: null } });

    // The delta chip is still worth showing -- the *direction* is real even when the load
    // is not. What must not appear is a tappable "Sugerido 100 kg".
    expect(screen.getByText(SET_LOGGER_LABELS.deltaChip("+2.5 kg"))).toBeTruthy();
    expect(
      setRows(container)[0].querySelector('[aria-label^="Usar el peso sugerido"]'),
    ).toBeNull();
  });

  it("offers the suggested load as a tap target when there is one", () => {
    const { container, props } = renderTable({ suggestion });
    const apply = setRows(container)[0].querySelector(
      '[aria-label^="Usar el peso sugerido"]',
    ) as HTMLElement;

    expect(apply).toBeTruthy();
    fireEvent.click(apply);

    // Applying carries the reps too: the weight alone would leave the row claiming one
    // thing and training another.
    expect(props.onChange).toHaveBeenCalledWith(0, {
      weight: "100",
      reps: "6",
      kind: "normal",
      completed: false,
      rpe: "",
      set_number: 1,
    });
  });
});

describe("no previous session", () => {
  it("still renders the sets, and offers no reference to compare them against", () => {
    renderTable({ previousKg: undefined, previousReps: undefined });

    expect(screen.queryByText("Anterior")).toBeNull();
    expect(row(1)).toBeTruthy();
    expect(row(3)).toBeTruthy();
  });
});
