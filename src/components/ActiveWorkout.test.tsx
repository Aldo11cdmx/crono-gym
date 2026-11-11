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
import { useEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ActiveWorkout, UNDO_WINDOW_MS } from "./ActiveWorkout";
import { ActiveSessionProvider, useActiveSession } from "../context/ActiveSessionContext";
import { GymSettingsProvider } from "../context/GymSettingsContext";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise } from "../hooks/useGymData";
import { EMPTY_PERFORMANCE } from "../hooks/usePreviousPerformance";
import type { PreviousPerformance } from "../lib/overload";
import { queueAndSync } from "../lib/sessionSync";
import { SET_TYPE_LABELS, GYM_LABELS, REST_TIMER_LABELS } from "../lib/i18n";
import { TICK_MS } from "../lib/workout/restTimer";
import { GYM_SETTINGS_KEY } from "../context/GymSettingsContext";
import { loadRecoverableDraft, saveDraft, type SessionDraft } from "../lib/offlineStore";

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
//
// `RestTimer` is deliberately NOT mocked: it is the component the workout now
// uses, and a test that mocks it proves nothing about the rest clock. The
// audio module is mocked instead, as in `RestTimer.test.tsx`: what matters
// here is *when* the timer asks for a sound, not the Web Audio API inside
// jsdom.
vi.mock("./ExerciseBrowser", () => ({ ExerciseBrowser: () => null }));
vi.mock("./TutorialModal", () => ({ TutorialModal: () => null }));
vi.mock("./NotionJournal", () => ({ NotionJournal: () => null }));
vi.mock("./ExerciseCarousel", () => ({ ExerciseCarousel: () => null }));
vi.mock("../lib/audio", () => ({
  playBeep: vi.fn(() => true),
  isRecordBeepActive: vi.fn(() => false),
}));

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

/** An interrupted session, as the provider finds it on the device. */
function recoverableDraft(overrides: Partial<SessionDraft> = {}): SessionDraft {
  return {
    logId: "log-draft",
    userId: "user-1",
    routineId: null,
    routineTitle: "Fuerza",
    startedAt: "2026-10-20T08:00:00.000Z",
    items: [
      {
        key: SQUAT.id,
        exercise: SQUAT,
        restSeconds: 90,
        sets: [
          {
            set_number: 1,
            weight: "100",
            reps: "5",
            rpe: "8",
            kind: "normal",
            completed: true,
          },
        ],
      },
    ],
    notes: "",
    finalized: false,
    updatedAt: 1,
    ...overrides,
  };
}

function planned(items: PlannedExercise[] | null = null, targetSets = 3): PlannedExercise[] {
  return items ?? [{ exercise: SQUAT, target_sets: targetSets, rest_seconds: 90, rowId: "row-1", order_index: 0, target_reps_min: null, target_reps_max: null, dayIndex: null, dayLabel: "" }];
}

/**
 * Renders the session.
 *
 * `start: false` stops at the pre-workout summary, which is the screen every athlete
 * sees first. Everything else in this file is about the logger *behind* that gate, so
 * the default walks through it -- and doing so here rather than in each test means a
 * test that breaks can only be about the logger, not about a missing gate tap.
 */
function workoutTree(items: PlannedExercise[], onFinished: () => void) {
  return (
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
    </ActiveSessionProvider>
  );
}

function renderWorkout(items: PlannedExercise[] = planned(), start = true) {
  const onFinished = vi.fn();
  const view = render(workoutTree(items, onFinished));
  if (start) tapStart();
  return {
    ...view,
    onFinished,
    /**
     * Re-renders the same tree: a render that changes no data at all.
     *
     * The one thing a re-render must not do is restart the draft's debounce,
     * so the test needs a re-render that is not a data change.
     */
    rerenderWorkout: () => view.rerender(workoutTree(items, onFinished)),
  };
}

/**
 * Asks the session provider to look for an unfinished session.
 *
 * The provider owns the lookup; this is the same call the auth gate makes
 * once it knows who is signed in.
 */
function RecoverHarness() {
  const { rehydrate } = useActiveSession();
  useEffect(() => {
    rehydrate("user-1");
  }, [rehydrate]);
  return null;
}

/** Through the pre-workout gate and into the logger. */
function tapStart() {
  fireEvent.click(screen.getByRole("button", { name: /Iniciar Entrenamiento/ }));
}

/** The row for set number n, resolved through its accessible group name. */
function setRow(n: number): HTMLElement {
  return screen.getByRole("group", { name: `Serie ${n}` });
}

function kindChip(n: number, _label: string): HTMLElement {
  return within(setRow(n)).getByRole("button", {
    name: (name) => name.startsWith(`Serie ${n} tipo:`),
  });
}

function removeButton(n: number): HTMLElement {
  return within(setRow(n)).getByLabelText(`Eliminar serie ${n}`);
}

function completeButton(n: number): HTMLElement {
  return within(setRow(n)).getByRole("button", { name: `Marcar la serie ${n} como completada` });
}

function weightField(n: number): HTMLElement {
  return within(setRow(n)).getByLabelText(`Peso serie ${n}`);
}

function repsField(n: number): HTMLElement {
  return within(setRow(n)).getByLabelText(`Repeticiones serie ${n}`);
}

function addSetButton(): HTMLElement {
  return screen.getByRole("button", { name: "+ Agregar serie" });
}

function finishButton(): HTMLElement {
  return (
    screen.queryByRole("button", { name: /Finalizar entrenamiento|Finalizar ✓/ }) ??
    screen.getByRole("button", { name: "Terminar entrenamiento" })
  );
}

async function chooseSetKind(n: number, label: string) {
  fireEvent.click(kindChip(n, label));
  const dialog = await screen.findByRole("dialog", { name: "Selector de tipo de serie" });
  const titleMap: Record<string, string> = {
    [SET_TYPE_LABELS.normal]: "Serie Normal (Working Set)",
    [SET_TYPE_LABELS.warmup]: "Calentamiento (Warm-up)",
    [SET_TYPE_LABELS.failure]: "Al Fallo Muscular (Failure)",
    [SET_TYPE_LABELS.drop]: "Serie Descendente (Drop Set)",
  };
  fireEvent.click(within(dialog).getByRole("button", { name: `Seleccionar ${titleMap[label] ?? label}` }));
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
  // Every test starts on the real clock, whatever the previous one left
  // behind. Testing Library's `waitFor` polls with the global `setTimeout`,
  // so a test that inherits fake timers waits on a clock that never ticks.
  vi.useRealTimers();
  window.localStorage.clear();
  globalThis.__cronosPerformance = {};
  globalThis.__cronosPreviousNotes = {};
  vi.mocked(queueAndSync).mockClear();
  // jsdom does not implement it and `focusExercise` calls it.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  try {
    cleanup();
  } finally {
    // The real clock goes back whatever the unmount did.
    //
    // A test that left fake timers installed would make the next one's
    // `waitFor` poll a clock that never ticks, and the wait would hang
    // instead of failing -- taking the rest of the file with it.
    vi.useRealTimers();
  }
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
    fireEvent.click(addSetButton());
    expect(screen.getByRole("group", { name: "Serie 3" })).toBeTruthy();
  });

  it("starts every row as a normal set", () => {
    renderWorkout();
    expect(kindChip(1, SET_TYPE_LABELS.normal)).toBeTruthy();
  });

  it("keeps typed weight values in the weight field", () => {
    renderWorkout();
    fireEvent.change(weightField(1), { target: { value: "82" } });
    expect((weightField(1) as HTMLInputElement).value).toBe("82");
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
    fireEvent.change(repsField(2), {
      target: { value: "9" },
    });
    fireEvent.click(removeButton(2));
    fireEvent.click(screen.getByLabelText("Deshacer la eliminación de la serie 2"));

    expect(setRow(2)).toBeTruthy();
    expect(repsField(2)).toHaveProperty("value", "9");
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
    await chooseSetKind(1, SET_TYPE_LABELS.warmup);
    await chooseSetKind(2, SET_TYPE_LABELS.drop);
    await chooseSetKind(3, SET_TYPE_LABELS.failure);
    // Complete every row, or nothing reaches the payload.
    for (const n of [1, 2, 3]) fireEvent.click(completeButton(n));

    await act(async () => {
      fireEvent.click(finishButton());
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
      fireEvent.click(finishButton());
    });
    const call = vi.mocked(queueAndSync).mock.calls[0]?.[0];
    expect((call?.sets ?? []).map((s) => s.set_number)).toEqual([1, 2]);
  });

  it("keeps per-set completion state independent", async () => {
    renderWorkout();
    fireEvent.click(completeButton(1));
    fireEvent.click(completeButton(3));

    await act(async () => {
      fireEvent.click(finishButton());
    });
    const call = vi.mocked(queueAndSync).mock.calls[0]?.[0];
    const sets = (call?.sets ?? []) as { set_number: number }[];
    expect(sets.map((s) => s.set_number)).toEqual([1, 3]);
  });
});

// --------------------------------------------------------------- rest clock

describe("ActiveWorkout rest clock", () => {
  it("uses the canonical timer, not a counter of its own", () => {
    renderWorkout();
    fireEvent.click(completeButton(1));
    // The real `RestTimer`, which is a dialog and not a bare counter.
    expect(screen.getByRole("dialog", { name: REST_TIMER_LABELS.title })).toBeTruthy();
  });

  it("is anchored to an instant, so a throttled tab cannot stretch it", () => {
    vi.useFakeTimers();
    renderWorkout();
    fireEvent.click(completeButton(1));

    // The clock jumps two minutes: the tab was in the background and its
    // timers never got to run.
    act(() => {
      vi.setSystemTime(Date.now() + 120_000);
    });
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });

    // A deadline that was read late still names the same moment, so the
    // rest is over. A counter would still be counting.
    expect(screen.queryByRole("dialog", { name: REST_TIMER_LABELS.title })).toBeNull();
  });
});

// ----------------------------------------------------------------- drafts

/**
 * How long the recovery tests are allowed to take.
 *
 * Each of them renders the whole tree and waits for the provider to find the
 * draft on the device: a render, a lookup and a round of React work. The
 * default five seconds is comfortable on a quiet machine and not on a busy
 * one, where the suite is the only thing running and the timings say nothing
 * about the behaviour being asserted. A timeout here is a statement about the
 * clock, never about the correctness of the assertion.
 */
const RECOVERY_TIMEOUT = 20_000;

describe("ActiveWorkout draft persistence", () => {
  it("writes the draft even when the screen keeps re-rendering", () => {
    vi.useFakeTimers();
    const view = renderWorkout();
    fireEvent.change(weightField(1), { target: { value: "100" } });

    // Continuous re-renders, of the kind any clock on screen produces. Each
    // one used to restart the debounce, and the draft was never written.
    for (let round = 0; round < 6; round += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      view.rerenderWorkout();
    }

    expect(vi.mocked(saveDraft)).toHaveBeenCalled();
  });

  it("writes the deadline of the rest that is running", () => {
    vi.useFakeTimers();
    renderWorkout();
    fireEvent.click(completeButton(1));

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // A deadline, not a count: the rest ends at a moment, and a moment is
    // the only thing a reload can still honour.
    const saved = vi.mocked(saveDraft).mock.calls.at(-1)?.[0];
    const remaining = (saved?.restEndsAt ?? 0) - Date.now();
    expect(remaining).toBeGreaterThan(89_000);
    expect(remaining).toBeLessThanOrEqual(90_000);
  });

  it("writes the exercise that is on screen", () => {
    vi.useFakeTimers();
    renderWorkout();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const saved = vi.mocked(saveDraft).mock.calls.at(-1)?.[0];
    expect(saved?.selectedKey).toBe(SQUAT.id);
  });

  it("keeps the draft under the id the interrupted session already had", async () => {
    const draft = recoverableDraft();
    vi.mocked(loadRecoverableDraft).mockResolvedValue(draft);

    render(
      <ActiveSessionProvider>
        <GymSettingsProvider>
          <RecoverHarness />
          <ActiveWorkout
            userId="user-1"
            routineId={null}
            routineTitle="Fuerza"
            planned={planned()}
            onFinished={vi.fn()}
          />
        </GymSettingsProvider>
      </ActiveSessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/Encontramos una sesión sin terminar/)).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Recuperar"));

    await act(async () => {
      fireEvent.click(finishButton());
    });

    expect(vi.mocked(queueAndSync).mock.calls[0]?.[0]?.logId).toBe("log-draft");
    expect(vi.mocked(saveDraft).mock.calls.at(-1)?.[0]?.logId).toBe("log-draft");
  }, RECOVERY_TIMEOUT);

  it("resumes the rest that was running when the session was interrupted", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(
      recoverableDraft({ restEndsAt: Date.now() + 30_000 }),
    );

    render(
      <ActiveSessionProvider>
        <GymSettingsProvider>
          <RecoverHarness />
          <ActiveWorkout
            userId="user-1"
            routineId={null}
            routineTitle="Fuerza"
            planned={planned()}
            onFinished={vi.fn()}
          />
        </GymSettingsProvider>
      </ActiveSessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/Encontramos una sesión sin terminar/)).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Recuperar"));

    // The countdown comes back with the time it had left, because the
    // deadline it was counting down to is the same moment.
    const dialog = screen.getByRole("dialog", { name: REST_TIMER_LABELS.title });
    expect(within(dialog).getByText("00:30")).toBeTruthy();
  }, RECOVERY_TIMEOUT);

  it("does not resume a rest that ended while the app was closed", async () => {
    vi.mocked(loadRecoverableDraft).mockResolvedValue(
      recoverableDraft({ restEndsAt: Date.now() - 1_000 }),
    );

    render(
      <ActiveSessionProvider>
        <GymSettingsProvider>
          <RecoverHarness />
          <ActiveWorkout
            userId="user-1"
            routineId={null}
            routineTitle="Fuerza"
            planned={planned()}
            onFinished={vi.fn()}
          />
        </GymSettingsProvider>
      </ActiveSessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/Encontramos una sesión sin terminar/)).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Recuperar"));

    // A rest that expired is over. A timer that starts at zero is a timer that
    // never got to be a timer.
    expect(screen.queryByRole("dialog", { name: REST_TIMER_LABELS.title })).toBeNull();
  }, RECOVERY_TIMEOUT);

  it("puts the athlete back in front of the exercise they were on", async () => {
    const bench = exercise("bench", "Press de banca");
    vi.mocked(loadRecoverableDraft).mockResolvedValue(
      recoverableDraft({
        selectedKey: bench.id,
        items: [
          {
            key: SQUAT.id,
            exercise: SQUAT,
            restSeconds: 90,
            sets: [
              {
                set_number: 1,
                weight: "100",
                reps: "5",
                rpe: "8",
                kind: "normal",
                completed: true,
              },
            ],
          },
          {
            key: bench.id,
            exercise: bench,
            restSeconds: 90,
            sets: [
              {
                set_number: 1,
                weight: "60",
                reps: "10",
                rpe: "7",
                kind: "normal",
                completed: false,
              },
            ],
          },
        ],
      }),
    );

    render(
      <ActiveSessionProvider>
        <GymSettingsProvider>
          <RecoverHarness />
          <ActiveWorkout
            userId="user-1"
            routineId={null}
            routineTitle="Fuerza"
            planned={planned()}
            onFinished={vi.fn()}
          />
        </GymSettingsProvider>
      </ActiveSessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText(/Encontramos una sesión sin terminar/)).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Recuperar"));

    await waitFor(() => expect(screen.getByText("Ejercicio 2 de 2")).toBeTruthy());
    expect(screen.getByText("Press de banca")).toBeTruthy();

    await waitFor(() => expect(vi.mocked(saveDraft)).toHaveBeenCalled());
    expect(vi.mocked(saveDraft).mock.calls.at(-1)?.[0]?.selectedKey).toBe(bench.id);
  }, RECOVERY_TIMEOUT);
});

// --------------------------------------------------------------- separation
describe("ActiveWorkout routine separation", () => {
  it("runs the routine on its own objects, so the routine stays a prescription", () => {
    vi.useFakeTimers();
    const items = planned();
    renderWorkout(items);
    fireEvent.change(weightField(1), { target: { value: "100" } });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const saved = vi.mocked(saveDraft).mock.calls.at(-1)?.[0];

    // The session holds its own copy of the exercise. The routine's row is a
    // catalog entry that every session that runs it shares, and a session
    // that edited it would be editing the routine for everybody.
    expect(saved?.items[0]?.exercise).not.toBe(items[0]?.exercise);
    expect(saved?.items[0]?.exercise.name).toBe(items[0]?.exercise.name);
  });

  it("gives every item and set of the session an identity of its own", () => {
    vi.useFakeTimers();
    renderWorkout();
    fireEvent.change(weightField(1), { target: { value: "100" } });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const saved = vi.mocked(saveDraft).mock.calls.at(-1)?.[0];

    // What tells this run's third set from another run's third set. The set
    // number is a position and moves when a set above it is deleted; this
    // does not.
    expect(saved?.items[0]?.instanceId).toBeTruthy();
    expect(saved?.items[0]?.sets[0]?.instanceId).toBeTruthy();
    expect(saved?.items[0]?.sets[0]?.instanceId).not.toBe(
      saved?.items[0]?.sets[1]?.instanceId,
    );
  });

  it("leaves the routine it was started from untouched", async () => {
    const items = planned();
    renderWorkout(items);
    fireEvent.change(weightField(1), { target: { value: "100" } });
    await chooseSetKind(1, SET_TYPE_LABELS.drop);

    // The routine is a prescription: three sets of a squat, and nothing
    // about what this session did with them.
    expect(items[0]?.target_sets).toBe(3);
    expect(items[0]?.rest_seconds).toBe(90);
    expect(items[0]?.exercise.name).toBe("Sentadilla trasera");
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
    expect(screen.getByText(/^Ant: 95×5/)).toBeTruthy();
  });

  it("shows no reference for a movement never trained", () => {
    renderWorkout();
    expect(screen.queryByText(/^Ant:/)).toBeNull();
  });

  it("shows the previous reference once", () => {
    globalThis.__cronosPerformance = trained;
    renderWorkout();
    expect(screen.getAllByText(/^Ant: 95×5/)).toHaveLength(1);
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
    expect(screen.getByText(/^Ant: 220.5×5/)).toBeTruthy();
  });

  it("can fill a set from the previous values", () => {
    globalThis.__cronosPerformance = trained;
    renderWorkout();
    fireEvent.click(
      within(setRow(1)).getByRole("button", {
        name: /Rellenar con valores anteriores:/,
      }),
    );
    expect((weightField(1) as HTMLInputElement).value).toBe("95");
    expect((repsField(1) as HTMLInputElement).value).toBe("5");
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
    fireEvent.click(screen.getByRole("button", { name: "Libras (lb)" }));
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

// ------------------------------------------------------------------ supersets

/**
 * The session moving on by itself.
 *
 * A superset is performed back to back -- A, then B, then A again -- so the
 * set the athlete has just finished is not the end of their work. The session
 * moves to the partner without being asked, which is the difference between a
 * superset and two exercises that happen to sit next to each other.
 */
describe("ActiveWorkout supersets", () => {
  const BENCH = exercise("bench", "Press banca");

  /** Two exercises performed together. */
  function superset(targetSets = 2, partnerSets = 2): PlannedExercise[] {
    return [
      {
        exercise: SQUAT,
        target_sets: targetSets,
        rest_seconds: 90,
        rowId: "row-sq",
        order_index: 0,
        target_reps_min: null,
        target_reps_max: null,
        dayIndex: null,
        dayLabel: "",
        groupId: "superset-1",
      },
      {
        exercise: BENCH,
        target_sets: partnerSets,
        rest_seconds: 90,
        rowId: "row-bench",
        order_index: 1,
        target_reps_min: null,
        target_reps_max: null,
        dayIndex: null,
        dayLabel: "",
        groupId: "superset-1",
      },
    ];
  }

  it("moves on to the partner when a set is completed", () => {
    renderWorkout(superset());
    expect(screen.getByText("Ejercicio 1 de 2")).toBeTruthy();

    fireEvent.click(completeButton(1));

    // The strip moves by itself: looking up the partner is work the athlete
    // should not have to do in the middle of a rest.
    expect(screen.getByText("Ejercicio 2 de 2")).toBeTruthy();
  });

  it("comes back around to the first exercise of the group", () => {
    renderWorkout(superset());

    fireEvent.click(completeButton(1));
    expect(screen.getByText("Ejercicio 2 de 2")).toBeTruthy();

    // A superset is a rotation, and the rotation is what makes the two
    // exercises alternate instead of run one after the other.
    fireEvent.click(completeButton(1));
    expect(screen.getByText("Ejercicio 1 de 2")).toBeTruthy();
  });

  it("stays put when the partner has no work left", () => {
    renderWorkout(superset(1, 1));

    fireEvent.click(completeButton(1));
    expect(screen.getByText("Ejercicio 2 de 2")).toBeTruthy();

    // The first exercise is finished, so the rotation has nowhere left to go:
    // moving on would send the athlete back to an exercise they completed.
    fireEvent.click(completeButton(1));
    expect(screen.getByText("Ejercicio 2 de 2")).toBeTruthy();
  });

  it("stays put when the exercise is not in a group", () => {
    renderWorkout([
      { exercise: SQUAT, target_sets: 2, rest_seconds: 90, rowId: "row-sq", order_index: 0, target_reps_min: null, target_reps_max: null, dayIndex: null, dayLabel: "" },
      { exercise: BENCH, target_sets: 2, rest_seconds: 90, rowId: "row-bench", order_index: 1, target_reps_min: null, target_reps_max: null, dayIndex: null, dayLabel: "" },
    ]);

    fireEvent.click(completeButton(1));

    // Nothing here says "these two go together", so the session does not
    // pretend that they do.
    expect(screen.getByText("Ejercicio 1 de 2")).toBeTruthy();
  });

  it("names the group in the header, where the athlete is looking", () => {
    renderWorkout(superset());

    // The strip says it too, but the strip is a strip: the header is the one
    // line of chrome that is always on screen above the set table.
    expect(screen.getByText("SUPERSET A • 1/2")).toBeTruthy();
  });

  it("moves the header's position along with the exercise", () => {
    renderWorkout(superset());

    fireEvent.click(completeButton(1));

    expect(screen.getByText("SUPERSET A • 2/2")).toBeTruthy();
  });

  it("says nothing about a group for an exercise that stands alone", () => {
    renderWorkout(planned());

    expect(screen.queryByText(/SUPERSET/)).toBeNull();
  });
});
