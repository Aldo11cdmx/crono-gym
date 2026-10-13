/**
 * @vitest-environment jsdom
 *
 * `ActiveWorkout` is the container where the logger's promises are kept: that a
 * duplicate really copies, that a delete is immediate *and* reversible, that the
 * warm-up kind survives all the way to the sync payload as the boolean the
 * database actually stores, and that swapping an exercise does not throw away
 * what was already logged against it.
 *
 * Everything with a side effect -- Supabase, IndexedDB, the sync queue, the
 * overlays -- is mocked, so these assertions are about the logger's own logic and
 * not about whether a test can reach a network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ActiveWorkout, UNDO_WINDOW_MS } from "./ActiveWorkout";
import { ActiveSessionProvider } from "../context/ActiveSessionContext";
import { GymSettingsProvider } from "../context/GymSettingsContext";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise } from "../hooks/useGymData";
import { EMPTY_PERFORMANCE } from "../hooks/usePreviousPerformance";
import type { PreviousPerformance } from "../lib/overload";
import { queueAndSync } from "../lib/sessionSync";
import { SET_TYPE_LABELS, GYM_LABELS } from "../lib/i18n";
import { GYM_SETTINGS_KEY } from "../context/GymSettingsContext";

// --------------------------------------------------------------------- mocks

vi.mock("@lib/supabase", () => ({
  supabase: { auth: {}, from: () => ({ select: () => ({ maybeSingle: async () => null }) }) },
}));

vi.mock("../lib/sessionSync", () => ({ queueAndSync: vi.fn(async () => null) }));
vi.mock("../lib/offlineStore", () => ({
  loadRecoverableDraft: vi.fn(async () => null),
  saveDraft: vi.fn(async () => undefined),
  deleteDraft: vi.fn(async () => undefined),
  newSessionId: () => "log-test",
}));
vi.mock("../hooks/useOfflineSync", () => ({
  useOfflineSync: () => ({
    status: "idle",
    pending: 0,
    online: true,
    error: null,
    syncNow: async () => undefined,
  }),
}));
vi.mock("../hooks/usePreviousPerformance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/usePreviousPerformance")>();
  return {
    ...actual,
    usePreviousPerformance: (): {
      performance: Record<string, PreviousPerformance>;
      previousNotes: Record<string, (string | null)[]>;
    } => ({
      performance: globalThis.__cronosPerformance ?? {},
      previousNotes: globalThis.__cronosPreviousNotes ?? {},
    }),
  };
});

// Overlays and the carousel pull in routing and media queries; they are not what
// this file is about.
vi.mock("./ExerciseBrowser", () => ({ ExerciseBrowser: () => null }));
vi.mock("./TutorialModal", () => ({ TutorialModal: () => null }));
vi.mock("./RestTimer", () => ({ RestTimer: () => null }));
vi.mock("./NotionJournal", () => ({ NotionJournal: () => null }));
vi.mock("./ExercisePanel", () => ({ ExercisePanel: () => null }));
vi.mock("./ExerciseCarousel", () => ({ ExerciseCarousel: () => null }));

// ------------------------------------------------------------------ fixtures

declare global {
  // eslint-disable-next-line no-var
  var __cronosPerformance: Record<string, PreviousPerformance> | undefined;
  // eslint-disable-next-line no-var
  var __cronosPreviousNotes: Record<string, (string | null)[]> | undefined;
}

function exercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    body_part: "upper legs",
    target: "quadriceps",
    equipment: "barbell",
  } as Exercise;
}

const SQUAT = exercise("squat", "Sentadilla trasera");

function planned(items: PlannedExercise[] | null = null, targetSets = 3): PlannedExercise[] {
  return items ?? [{ exercise: SQUAT, target_sets: targetSets, rest_seconds: 90, dayIndex: null, dayLabel: "" }];
}

/**
 * Renders the session.
 *
 * `start: false` stops at the pre-workout summary, which is the screen every athlete
 * sees first. Everything else in this file is about the logger *behind* that gate, so
 * the default walks through it -- and doing so here rather than in each test means a
 * test that breaks can only be about the logger, not about a missing gate tap.
 */
function renderWorkout(items: PlannedExercise[] = planned(), start = true) {
  const onFinished = vi.fn();
  const view = render(
    <ActiveSessionProvider>
      <GymSettingsProvider>
        <ActiveWorkout
          userId="user-1"
          routineId={null}
          routineTitle="Fuerza"
          planned={items}
          onFinished={onFinished}
        />
      </GymSettingsProvider>
    </ActiveSessionProvider>,
  );
  if (start) tapStart();
  return { ...view, onFinished };
}

/** Through the pre-workout gate and into the logger. */
function tapStart() {
  fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
}

/** The row for set number n, resolved through its accessible group name. */
function setRow(n: number): HTMLElement {
  return screen.getByRole("group", { name: `Serie ${n}` });
}

function kindChip(n: number, label: string): HTMLElement {
  return within(setRow(n)).getByRole("button", { name: `Serie ${n} de tipo ${label}` });
}

function removeButton(n: number): HTMLElement {
  return within(setRow(n)).getByLabelText(`Eliminar la serie ${n}`);
}

function duplicateButton(n: number): HTMLElement {
  return within(setRow(n)).getByLabelText(`Duplicar la serie ${n}`);
}

function completeButton(n: number): HTMLElement {
  return within(setRow(n)).getByRole("button", { name: `Marcar la serie ${n} como completada` });
}

function weightField(n: number): HTMLElement {
  return within(setRow(n)).getByRole("spinbutton", { name: /Peso:/ });
}

/**
 * Tailwind's colour utilities, by family.
 *
 * Matched positively rather than as "anything ending in -NNN" so `brightness-110`
 * and `z-40` do not read as colours.
 */
const TAILWIND_COLOR_UTILITIES =
  /\b(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d{2,3})\b/g;

beforeEach(() => {
  window.localStorage.clear();
  globalThis.__cronosPerformance = {};
  globalThis.__cronosPreviousNotes = {};
  vi.mocked(queueAndSync).mockClear();
  // jsdom does not implement it and `focusExercise` calls it.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------- rows

describe("ActiveWorkout set rows", () => {
  it("renders one row per planned set", () => {
    renderWorkout(planned(null, 4));
    expect(screen.getByRole("group", { name: "Serie 1" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Serie 4" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Serie 5" })).toBeNull();
  });

  it("adds a row on demand", () => {
    renderWorkout(planned(null, 2));
    expect(screen.queryByRole("group", { name: "Serie 3" })).toBeNull();
    fireEvent.click(screen.getByText("+ Agregar serie"));
    expect(screen.getByRole("group", { name: "Serie 3" })).toBeTruthy();
  });

  it("starts every row as a normal set", () => {
    renderWorkout();
    expect(kindChip(1, SET_TYPE_LABELS.normal).getAttribute("aria-pressed")).toBe("true");
  });

  it("snaps a typed weight onto the rack's real steps", () => {
    renderWorkout();
    // 82 kg is 31 per side; the gym's smallest step is 2.5, so the nearest real
    // load is 80. The row must never hold a weight the plates cannot build.
    fireEvent.change(weightField(1), { target: { value: "82" } });
    fireEvent.focusOut(weightField(1));
    expect((weightField(1) as HTMLInputElement).value).toBe("80");
  });
});

describe("ActiveWorkout duplicating a set", () => {
  it("inserts the copy directly below the original", () => {
    renderWorkout();
    fireEvent.change(weightField(1), { target: { value: "105" } });
    fireEvent.focusOut(weightField(1));
    fireEvent.click(duplicateButton(1));

    expect(setRow(2).textContent).toContain("105");
    expect(screen.getByRole("group", { name: "Serie 3" })).toBeTruthy();
  });

  it("copies weight, reps, RPE and kind together", () => {
    renderWorkout();
    fireEvent.change(within(setRow(1)).getByLabelText("Repeticiones"), {
      target: { value: "6" },
    });
    fireEvent.click(kindChip(1, SET_TYPE_LABELS.drop));
    fireEvent.click(duplicateButton(1));

    expect(kindChip(2, SET_TYPE_LABELS.drop).getAttribute("aria-pressed")).toBe("true");
    expect(within(setRow(2)).getByLabelText("Repeticiones")).toHaveProperty("value", "6");
  });

  it("keeps completion off the copy, because it is work not yet done", () => {
    renderWorkout();
    fireEvent.click(completeButton(1));
    fireEvent.click(duplicateButton(1));
    // Series 2 is the copy and is still open; series 1 is the completed original.
    expect(
      within(setRow(1)).getByRole("button", { name: "Marcar la serie 1 como no completada" }),
    ).toBeTruthy();
    expect(
      within(setRow(2)).getByRole("button", { name: "Marcar la serie 2 como completada" }),
    ).toBeTruthy();
  });
});

describe("ActiveWorkout deleting a set", () => {
  it("removes the row immediately rather than asking", () => {
    renderWorkout();
    fireEvent.click(removeButton(2));
    // Series 3 slides up into slot 2, so there are two rows, not three.
    expect(setRow(2)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Serie 3" })).toBeNull();
  });

  it("offers an undo banner naming the set", () => {
    renderWorkout();
    fireEvent.click(removeButton(2));
    expect(screen.getByText("Serie 2 eliminada")).toBeTruthy();
    expect(screen.getByLabelText("Deshacer la eliminación de la serie 2")).toBeTruthy();
  });

  it("brings the row back to the same position", () => {
    renderWorkout();
    fireEvent.change(within(setRow(2)).getByLabelText("Repeticiones"), {
      target: { value: "9" },
    });
    fireEvent.click(removeButton(2));
    fireEvent.click(screen.getByLabelText("Deshacer la eliminación de la serie 2"));

    expect(setRow(2)).toBeTruthy();
    expect(within(setRow(2)).getByLabelText("Repeticiones")).toHaveProperty("value", "9");
    expect(screen.queryByText("Serie 2 eliminada")).toBeNull();
  });

  it("closes the window on its own after five seconds", () => {
    vi.useFakeTimers();
    renderWorkout();
    fireEvent.click(removeButton(1));

    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    });
    expect(screen.getByText("Serie 1 eliminada")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Serie 1 eliminada")).toBeNull();
    // The rows stay shifted up: the window closed, it did not roll back.
    expect(setRow(2)).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Serie 3" })).toBeNull();
  });

  it("can be dismissed early", () => {
    renderWorkout();
    fireEvent.click(removeButton(1));
    fireEvent.click(screen.getByLabelText("Cerrar aviso de eliminación"));
    expect(screen.queryByText("Serie 1 eliminada")).toBeNull();
    expect(screen.queryByRole("group", { name: "Serie 3" })).toBeNull();
  });

  it("keeps at most one recoverable deletion", () => {
    // A stack of banners competing for the same corner of a phone screen mid-set
    // is worse than losing the older undo.
    renderWorkout();
    fireEvent.click(removeButton(1));
    fireEvent.click(removeButton(1));
    expect(screen.getAllByText(/eliminada/)).toHaveLength(1);
  });
});

// ------------------------------------------------------------------- payloads

describe("ActiveWorkout set kind at the persistence boundary", () => {
  async function finishAndReadSets(): Promise<{ is_warmup: boolean }[]> {
    renderWorkout();
    fireEvent.click(kindChip(1, SET_TYPE_LABELS.warmup));
    fireEvent.click(kindChip(2, SET_TYPE_LABELS.drop));
    fireEvent.click(kindChip(3, SET_TYPE_LABELS.failure));
    // Complete every row, or nothing reaches the payload.
    for (const n of [1, 2, 3]) fireEvent.click(completeButton(n));

    await act(async () => {
      fireEvent.click(screen.getByText("Finalizar"));
    });

    const call = vi.mocked(queueAndSync).mock.calls[0]?.[0];
    return (call?.sets ?? []) as { is_warmup: boolean }[];
  }

  it("maps the warm-up kind onto the boolean the column stores", async () => {
    const sets = await finishAndReadSets();
    expect(sets.map((s) => s.is_warmup)).toEqual([true, false, false]);
  });

  it("counts a drop set and a failure set as real work", async () => {
    const sets = await finishAndReadSets();
    expect(sets).toHaveLength(3);
  });

  it("renumbers the payload so a deleted set does not leave a gap", async () => {
    renderWorkout();
    fireEvent.click(removeButton(1));
    // Two rows remain, and they have slid into slots 1 and 2.
    fireEvent.click(completeButton(1));
    fireEvent.click(completeButton(2));

    await act(async () => {
      fireEvent.click(screen.getByText("Finalizar"));
    });
    const call = vi.mocked(queueAndSync).mock.calls[0]?.[0];
    expect((call?.sets ?? []).map((s) => s.set_number)).toEqual([1, 2]);
  });

  it("carries the per-set note onto the row it belongs to", async () => {
    // The note is written mid-session, behind its own glyph, and has to
    // land on the same `completed_sets` row as the weight it describes --
    // not on the log, and not on the wrong set.
    renderWorkout();
    fireEvent.click(within(setRow(1)).getByLabelText("Nota de la serie 1"));
    fireEvent.change(
      within(setRow(1)).getByLabelText("Texto de la nota de la serie 1"),
      { target: { value: "rodilla protestó" } },
    );
    // Blur closes the field and flushes the draft.
    fireEvent.blur(
      within(setRow(1)).getByLabelText("Texto de la nota de la serie 1"),
    );
    for (const n of [1, 2, 3]) fireEvent.click(completeButton(n));

    await act(async () => {
      fireEvent.click(screen.getByText("Finalizar"));
    });
    const call = vi.mocked(queueAndSync).mock.calls[0]?.[0];
    const sets = (call?.sets ?? []) as { set_number: number; notes: string | null }[];
    expect(sets.find((s) => s.set_number === 1)?.notes).toBe("rodilla protestó");
    expect(sets.find((s) => s.set_number === 2)?.notes).toBeNull();
  });
});

// ------------------------------------------------------------------- previous

describe("ActiveWorkout previous session", () => {
  /** A strong previous set, as the engine would report it. */
  const trained = {
    squat: { ...EMPTY_PERFORMANCE, bestSet: { weight: 95, reps: 5, rpe: 8, is_warmup: false } },
  };

  it("shows a last-session reference on the exercise header", () => {
    globalThis.__cronosPerformance = trained;
    renderWorkout();
    // A metric standing on its own, not a chip: it is the exercise's caption,
    // and it stays visible when the lifter has scrolled past series 1.
    expect(screen.getByText("Última sesión: 95 kg × 5")).toBeTruthy();
  });

  it("shows no reference for a movement never trained", () => {
    renderWorkout();
    expect(screen.queryByText(/Última sesión:/)).toBeNull();
  });

  it("does not repeat the header sentence on the row", () => {
    globalThis.__cronosPerformance = trained;
    renderWorkout();
    // The header is a caption and the stepper chip is an action. Two identical
    // sentences on one screen would read as a mistake, and only one of them
    // would be clickable.
    expect(screen.getAllByText(/Última sesión: 95 kg × 5/)).toHaveLength(1);
  });

  it("converts the header reference to the user's unit", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ weightUnit: "lb" }),
    );
    globalThis.__cronosPerformance = {
      squat: { ...EMPTY_PERFORMANCE, bestSet: { weight: 100, reps: 5, rpe: 8, is_warmup: false } },
    };
    renderWorkout();
    expect(screen.getByText("Última sesión: 220.5 lb × 5")).toBeTruthy();
  });

  it("feeds the previous weight to the opening set's stepper only", () => {
    globalThis.__cronosPerformance = trained;
    renderWorkout();
    expect(
      within(setRow(1)).getByLabelText("Repetir la última vez: 95 kilos por 5 repeticiones"),
    ).toBeTruthy();
    expect(within(setRow(2)).queryByText("95 × 5")).toBeNull();
  });
});

// -------------------------------------------------------------------- hygiene

describe("ActiveWorkout gym settings entry point", () => {
  const GEAR = GYM_LABELS.triggerAriaLabel(GYM_LABELS.defaultTriggerContext);

  it("offers the gear in the header, not per set row", () => {
    // The rack is one fact for the whole session. A gear on every row would read
    // as "these plates apply to this exercise only", and there is no second gear
    // to reach for.
    renderWorkout();
    expect(screen.getAllByRole("button", { name: GEAR })).toHaveLength(1);
    expect(within(setRow(1)).queryByRole("button", { name: GEAR })).toBeNull();
  });

  it("opens the panel, so the header gear is not decoration", () => {
    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: GEAR }));
    expect(screen.getByRole("dialog", { name: GYM_LABELS.title })).toBeTruthy();
  });

  it("lets a plate change reach the rack the stepper reads", () => {
    // The promise the panel's own docblock makes: one tap from the logger, and
    // the tap has to actually change what is offered.
    renderWorkout();
    fireEvent.click(screen.getByRole("button", { name: GEAR }));
    fireEvent.click(screen.getByRole("button", { name: "lb" }));
    const stored = window.localStorage.getItem(GYM_SETTINGS_KEY);
    expect(JSON.parse(stored as string).weightUnit).toBe("lb");
  });
});

describe("ActiveWorkout colour hygiene", () => {
  /** Every `class` attribute in the rendered tree, joined. */
  function classNames(container: HTMLElement): string {
    return [...container.querySelectorAll("[class]")]
      .map((node) => node.getAttribute("class") ?? "")
      .join(" ");
  }

  it("carries no raw colour literal in any class attribute", () => {
    // `text-[#f5a524]` is the usual way a hue sneaks back in without anyone
    // touching the token table, so the literal is checked for directly.
    const { container } = renderWorkout();
    expect(classNames(container)).not.toMatch(/(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i);
  });

  it("leaves only the neutral ramp as a colour utility", () => {
    const { container } = renderWorkout();
    const families = [
      ...new Set((classNames(container).match(TAILWIND_COLOR_UTILITIES) ?? []).map((u) => u.split("-")[0])),
    ];
    // Any other family is a hue that would have to earn its place in
    // `tokens.ts` first.
    for (const family of families) {
      expect(family, `unexpected colour family ${family}`).toBe("neutral");
    }
  });
});
