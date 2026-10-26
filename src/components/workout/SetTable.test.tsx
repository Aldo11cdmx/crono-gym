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
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { SetTable, type SetTableProps } from "./SetTable";
import { SET_LOGGER_LABELS, SET_TYPE_LABELS, FATIGUE_LABELS } from "../../lib/i18n";
import {
  REST_PREFERENCES_KEY,
  REST_STEP_SECONDS,
} from "../../lib/workout/restPreferences";
import type { OverloadTarget } from "../../lib/overload";
import type { SetEntry } from "../../lib/workout/types";
import { sameColor } from "../../test-support/color";
import { GLASS, MOTION, NUMERIC, STATUS, SURFACE, TEXT, TYPE } from "../../design/tokens";

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

/** The `PREVIA` row, which is a caption rather than a labelled control. */
function previousRow(): HTMLElement {
  return screen
    .getByRole("group", { name: "Previa de la sesion anterior" })
    .closest("div")!;
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

describe("the PREVIA row", () => {
  it("appears when there is a previous set, and not when there is not", () => {
    const { unmount } = renderTable({ previousKg: 95, previousReps: 5 });
    expect(screen.getAllByText("PREVIA").length).toBeGreaterThan(0);
    unmount();

    renderTable({ previousKg: null });
    expect(screen.queryByText("PREVIA")).toBeNull();
  });

  it("puts the weight and the reps in the same mono run", () => {
    renderTable({ previousKg: 95, previousReps: 5 });

    // One run, not "95" and "5" in separate cells: the pair is a single fact about a
    // single set, and splitting it invites reading the reps against the wrong weight.
    expect(previousRow().textContent).toContain("95 × 5");
  });

  it("includes the RPE when provided", () => {
    renderTable({ previousKg: 95, previousReps: 5, previousRpe: 8 });

    expect(previousRow().textContent).toContain("@8 95 × 5");
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
  it("labels all five columns once, outside the rows", () => {
    const { container } = renderTable({ previousKg: 95, previousReps: 5 });

    // The cells are unbordered by design, and five identical unlabelled boxes in a row is
    // not a table, it is a row of boxes. Counted outside the set groups because each row
    // repeats its own label over its own cell.
    const headings = screen
      .getAllByText(/^(SERIE|PREVIA|KG|REPES|RPE)$/)
      .filter((el) => !el.closest("[role='group']"));
    expect(headings.map((el) => el.textContent)).toEqual(["SERIE", "PREVIA", "KG", "REPES", "RPE"]);
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

describe("the set-kind badge", () => {
  it("opens the type sheet when the badge is tapped", () => {
    renderTable();

    fireEvent.click(
      within(row(1)).getByRole("button", {
        name: SET_LOGGER_LABELS.setBadgeAriaLabel(SET_TYPE_LABELS.normal, 1),
      }),
    );

    expect(
      screen.getByRole("button", {
        name: SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS.drop, 1),
      }),
    ).toBeTruthy();
  });

  it("reports the new kind against the right row", () => {
    const { props } = renderTable();

    fireEvent.click(
      within(row(2)).getByRole("button", {
        name: SET_LOGGER_LABELS.setBadgeAriaLabel(SET_TYPE_LABELS.normal, 2),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS.drop, 2),
      }),
    );

    expect(props.onChange).toHaveBeenCalledWith(1, expect.objectContaining({ kind: "drop" }));
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

    expect(screen.queryByText("PREVIA")).toBeNull();
    expect(row(1)).toBeTruthy();
    expect(row(3)).toBeTruthy();
  });
});

describe("the record badge", () => {
  /**
   * Completing a set through the toggle, the way the athlete does it, rather
   * than through a prop -- the badge has to be earned by the flip, not by a
   * value the caller happened to pass.
   */
  function completeSet(
    index: number,
    overrides: Partial<SetTableProps> = {},
  ) {
    const { props } = renderTable({
      sets: [
        set({
          set_number: index + 1,
          weight: "100",
          reps: "8",
        }),
      ],
      ...overrides,
    });
    fireEvent.click(
      within(row(1)).getByRole("button", {
        name: SET_LOGGER_LABELS.completeAriaLabel(1, false),
      }),
    );
    return props;
  }

  it("fires when the set beats the all-time best", () => {
    completeSet(0, {
      exerciseName: "Press de banca",
      allTimeBestKg: 100,
      allTimeBestReps: 5,
    });

    const alert = screen.getByRole("alert");
    // The estimate of 100×8 is 126.7 against a best of 100×5 at 116.7. The
    // weight goes through the caller's `formatWeight`, which is the reason that
    // is a prop: the badge spells the unit the way the rest of the screen does.
    expect(alert.getAttribute("aria-label")).toBe(
      "Nuevo récord: Press de banca: 100 × 8",
    );
  });

  it("spells the weight through the caller's formatter, unit included", () => {
    renderTable({
      sets: [set({ set_number: 1, weight: "92.5", reps: "8" })],
      exerciseName: "Press de banca",
      allTimeBestKg: 80,
      allTimeBestReps: 5,
      formatWeight: (kg) => `${(kg * 2.20462).toFixed(1)} lb`,
    });
    fireEvent.click(
      within(row(1)).getByRole("button", {
        name: SET_LOGGER_LABELS.completeAriaLabel(1, false),
      }),
    );

    // 92.5 kg on an imperial screen reads as 203.9 lb, and the badge is the one
    // place it must not revert to kg.
    expect(screen.getByRole("alert").getAttribute("aria-label")).toBe(
      "Nuevo récord: Press de banca: 203.9 lb × 8",
    );
  });

  it("still flips the set even when it is a record", () => {
    // The badge is a decoration on the completion, never a condition of it. If
    // the record check ever threw or short-circuited, the set would stay open.
    const props = completeSet(0, {
      exerciseName: "Press de banca",
      allTimeBestKg: 100,
      allTimeBestReps: 5,
    });

    expect(props.onChange).toHaveBeenCalledWith(0, {
      set_number: 1,
      weight: "100",
      reps: "8",
      rpe: "",
      kind: "normal",
      completed: true,
    });
  });

  it("stays silent when the set only matches the best", () => {
    // 100×5 against a best of 100×5: holding the record is not breaking it, and
    // a badge for holding it would fire on every repeat of the record weight.
    completeSet(0, {
      exerciseName: "Press de banca",
      allTimeBestKg: 100,
      allTimeBestReps: 5,
      sets: [set({ set_number: 1, weight: "100", reps: "5" })],
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stays silent on a first set, because a first is not a record", () => {
    // No all-time best means nothing was beaten. "Nuevo récord" here would be a
    // claim about a competition that has not happened.
    completeSet(0, { exerciseName: "Press de banca" });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stays silent for a warm-up set, whatever it lifts", () => {
    // A warm-up is preparation, and `useAthletePRs` filters `is_warmup` for the
    // same reason: crowning one would put a record on a load the athlete was
    // easing into.
    const { props } = renderTable({
      sets: [set({ set_number: 1, weight: "140", reps: "3", kind: "warmup" })],
      exerciseName: "Sentadilla",
      allTimeBestKg: 100,
      allTimeBestReps: 5,
    });
    fireEvent.click(
      within(row(1)).getByRole("button", {
        name: SET_LOGGER_LABELS.completeAriaLabel(1, false),
      }),
    );

    expect(screen.queryByRole("alert")).toBeNull();
    // The warm-up set still completes.
    expect(props.onChange).toHaveBeenCalledWith(0, expect.objectContaining({ completed: true }));
  });

  it("stays silent for a set past the estimable range", () => {
    // 100×11 has no 1RM to compare, so claiming a record for it would be a
    // second rule from the one the Records tab uses.
    completeSet(0, {
      exerciseName: "Press de banca",
      allTimeBestKg: 100,
      allTimeBestReps: 5,
      sets: [set({ set_number: 1, weight: "100", reps: "11" })],
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stays silent when there is no exercise name to show", () => {
    // The badge names the movement; without a name it has nothing honest to say.
    completeSet(0, { allTimeBestKg: 100, allTimeBestReps: 5 });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dismisses itself, so it cannot cover the set logger", () => {
    vi.useFakeTimers();
    try {
      completeSet(0, {
        exerciseName: "Press de banca",
        allTimeBestKg: 100,
        allTimeBestReps: 5,
      });
      expect(screen.getByRole("alert")).toBeTruthy();

      // Past the badge's own four seconds plus its exit: a confirmation left
      // on screen is one that covers the set the athlete is on next.
      // `act` because the timers call React state setters, and a state
      // update outside `act` never reaches the DOM the query reads.
      act(() => void vi.advanceTimersByTime(4500));
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the fatigue verdict", () => {
  /** A plan to repeat: ten reps at a hundred, however heavy. */
  const TARGET: OverloadTarget = {
    decision: "hold",
    weight: 100,
    reps: 10,
    repRange: { min: 10, max: 10 },
    incrementKg: 2.5,
    delta: "+0 kg",
    reason: "mantener la carga",
    estimateConfident: true,
  };

  /** Two sets that fell short of the plan, and one that met it. */
  const TIRED_SESSION = [
    set({ set_number: 1, weight: "100", reps: "8", completed: true }),
    set({ set_number: 2, weight: "100", reps: "8", completed: true }),
    set({ set_number: 3, weight: "100", reps: "10", completed: true }),
  ];

  it("marks a completed set that fell short of the plan", () => {
    renderTable({ sets: [TIRED_SESSION[0]], suggestion: TARGET });
    // The badge rides on the row it belongs to, beside the
    // set number it is about.
    expect(
      within(row(1)).getByText(FATIGUE_LABELS.shortfallText(2)),
    ).toBeTruthy();
  });

  it("never marks a warm-up, however short it is", () => {
    renderTable({
      sets: [
        set({
          set_number: 1,
          weight: "60",
          reps: "5",
          kind: "warmup",
          completed: true,
        }),
      ],
      suggestion: TARGET,
    });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("never marks a set that met the plan", () => {
    renderTable({
      sets: [
        set({ set_number: 1, weight: "100", reps: "10", completed: true }),
      ],
      suggestion: TARGET,
    });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("summarizes once two sets have fallen short", () => {
    renderTable({
      exerciseId: "sentadilla",
      restSeconds: 90,
      sets: TIRED_SESSION,
      suggestion: TARGET,
    });
    expect(screen.getByText(FATIGUE_LABELS.summary(2, 3))).toBeTruthy();
  });

  it("waits for a second tired set before summarizing", () => {
    // One tired set is a bad set; two are a session.
    renderTable({
      exerciseId: "sentadilla",
      sets: [TIRED_SESSION[0], TIRED_SESSION[2]],
      suggestion: TARGET,
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stays silent when the table names no exercise", () => {
    // Without an exercise id there is nowhere to remember a
    // longer rest, so the summary would offer an action that
    // cannot exist.
    renderTable({ sets: TIRED_SESSION, suggestion: TARGET });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("remembers a longer rest when the athlete asks for one", () => {
    renderTable({
      exerciseId: "sentadilla",
      restSeconds: 90,
      sets: TIRED_SESSION,
      suggestion: TARGET,
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: FATIGUE_LABELS.restMoreAriaLabel(REST_STEP_SECONDS),
      }),
    );

    // The preference is absolute: the rest that was running
    // plus the offered step, stored for this exercise alone.
    expect(window.localStorage.getItem(REST_PREFERENCES_KEY)).toBe(
      JSON.stringify({ sentadilla: 90 + REST_STEP_SECONDS }),
    );
    // And the verdict is done talking: the answer is remembered,
    // not left covering the sets.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("lets the athlete dismiss the verdict for the session", () => {
    renderTable({
      exerciseId: "sentadilla",
      sets: TIRED_SESSION,
      suggestion: TARGET,
    });
    fireEvent.click(
      screen.getByRole("button", { name: FATIGUE_LABELS.dismissAriaLabel }),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
