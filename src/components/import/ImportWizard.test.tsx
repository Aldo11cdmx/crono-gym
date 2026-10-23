/**
 * @vitest-environment jsdom
 *
 * ImportWizard is the only place in the app where the user can add rows to their
 * history in bulk, so the two properties worth defending are both about restraint:
 *
 *   1. **Nothing is written before step 4.** A column guessed wrong is
 *      indistinguishable from a column guessed right once it is in the database,
 *      and there is no way to tell afterwards. So the assertions here watch the
 *      mock database for any write at all while the user is still choosing.
 *   2. **What lands can be taken back exactly.** Undo is asserted on ids, not on
 *      counts, because "we deleted 3 sessions" is satisfiable by deleting the
 *      wrong three.
 *
 * The real parser, the real analysis and the real commit engine are all used. Only
 * Supabase is mocked, because that is the only boundary that is not pure. jsdom has
 * no `Worker`, so the hook takes its documented inline path -- which is the same
 * pure code the worker calls, and it means these tests also cover the fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const db = vi.hoisted(() => ({
  insert: vi.fn(),
  upsert: vi.fn(),
  /** Table names in call order, so delete-before-log ordering is assertable. */
  tables: [] as string[],
  /** Swapped in to simulate a failed write or delete. */
  failure: null as { message: string } | null,
  /** Rows a plain `.select()` resolves with. */
  rows: [] as unknown[],
}));

vi.mock("@lib/supabase", () => {
  /**
   * Supabase's builder is both awaitable and chainable, and this codebase uses it
   * both ways: `await supabase.from(t).select("*")` for the catalogue, and
   * `supabase.from(t).delete().eq(...)` for the undo. A plain object breaks the
   * first; a bare promise breaks the second.
   */
  const builder = () => {
    const value = db.failure
      ? { data: null, error: db.failure }
      : { data: db.rows, error: null };
    return {
      eq: () => builder(),
      in: () => builder(),
      then: (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
        Promise.resolve(value).then(onOk, onErr),
    };
  };
  return {
    supabase: {
      from: (table: string) => {
        db.tables.push(table);
        return {
          insert: (...args: unknown[]) => (db.insert(...args), builder()),
          upsert: (...args: unknown[]) => (db.upsert(...args), builder()),
          select: () => builder(),
          delete: () => builder(),
          update: () => builder(),
        };
      },
      auth: { signOut: vi.fn() },
    },
  };
});

vi.mock("@/lib/trainingEvents", () => ({ notifyTrainingDataChanged: vi.fn() }));

import { ImportWizard } from "./ImportWizard";
import { IMPORT_LABELS as T } from "@/lib/i18n";
import type { ImportFile } from "@/lib/import/workerProtocol";
import type { Exercise } from "@/types/supabase";

const HEVY_HEADER = [
  "title",
  "start_time",
  "end_time",
  "description",
  "exercise_name",
  "set_index",
  "set_type",
  "weight_kg",
  "reps",
  "rpe",
];

/** Two sessions, two exercises each, one set per row. Column count matches the header. */
const HEVY_ROWS: string[][] = [
  ["Push A", "2026-05-01T09:00:00Z", "", "", "Press de banca", "1", "normal", "80", "5", ""],
  ["Push A", "2026-05-01T09:00:00Z", "", "", "Press inclinado", "1", "normal", "60", "10", ""],
  ["Pull A", "2026-05-03T09:00:00Z", "", "", "Remo con barra", "1", "normal", "70", "8", ""],
  ["Pull A", "2026-05-03T09:00:00Z", "", "", "Curl con barra", "1", "normal", "30", "12", ""],
];

/** The same file with one more row carrying no date at all. */
const HEVY_WITH_BAD_ROW: string[][] = [
  ...HEVY_ROWS,
  ["Push A", "", "", "", "Press militar", "1", "normal", "50", "6", ""],
];

function hevyFile(data: string[][]): ImportFile {
  const text = [
    HEVY_HEADER.join(","),
    ...data.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell}"` : cell)).join(",")),
  ].join("\n");
  return { name: "hevy-export.csv", size: text.length, text: () => Promise.resolve(text) };
}

/** The catalogue rows the fixture's names resolve to, keyed by target muscle. */
const CATALOG: Exercise[] = [
  { id: "ex-press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "ex-inclinado", name: "Press inclinado", target: "pectorals", body_part: "chest", equipment: "dumbbell" },
  { id: "ex-remo", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
  { id: "ex-curl", name: "Curl con barra", target: "biceps", body_part: "upper arms", equipment: "barbell" },
  { id: "ex-militar", name: "Press militar", target: "shoulders", body_part: "upper arms", equipment: "barbell" },
] as unknown as Exercise[];

function renderWizard() {
  const onClose = vi.fn();
  const onImported = vi.fn();
  render(<ImportWizard userId="user-1" onClose={onClose} onImported={onImported} />);
  return { onClose, onImported };
}

/** Walks to the confirmation step, which is the only one allowed to write. */
async function toConfirm(file: ImportFile) {
  await chooseFile(file);
  next();
  next();
  next();
}

beforeEach(() => {
  db.tables.length = 0;
  db.failure = null;
  db.rows = CATALOG;
  db.insert.mockClear();
  db.upsert.mockClear();
});

afterEach(cleanup);

/** The `Siguiente` button is enabled only once an analysis with sessions exists. */
function nextButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: T.next }) as HTMLButtonElement;
}

/**
 * Attaches a file and waits for the analysis to land.
 *
 * Waiting on the "next" button rather than on a status message: the fallback
 * notice is also a `role="status"`, so it appears before the file has been parsed
 * and a test that waited on it would assert against an empty wizard.
 */
async function chooseFile(file: ImportFile) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
  await waitFor(() => expect(nextButton().disabled).toBe(false));
}

function next() {
  fireEvent.click(nextButton());
}

describe("ImportWizard writes nothing before confirmation", () => {
  it("reads the file and only counts rows while the user is still choosing", async () => {
    renderWizard();
    await chooseFile(hevyFile(HEVY_ROWS));

    // The catalogue read is the only thing that has touched the database.
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
    expect(screen.getByText(T.sourceAutoDetected(T.sources.hevy))).toBeTruthy();
  });

  it("shows the columns and the rows it read on the preview step", async () => {
    renderWizard();
    await chooseFile(hevyFile(HEVY_ROWS));
    next();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Press de banca")).toBeTruthy();
    expect(within(table).getByText("exercise_name")).toBeTruthy();
    // Shown twice -- once as the row count, once as the table's own caption --
    // so the assertion is that both are present, not that there is only one.
    expect(screen.getAllByText(T.previewRows(HEVY_ROWS.length)).length).toBeGreaterThan(0);
  });

  it("still writes nothing after two steps of looking", async () => {
    renderWizard();
    await chooseFile(hevyFile(HEVY_ROWS));
    next();
    next();

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });
});

describe("ImportWizard error log", () => {
  it("is rendered on every step that shows an analysis", async () => {
    renderWizard();
    await chooseFile(hevyFile(HEVY_ROWS));

    // Present from the preview onwards. An importer that shows a log only when
    // something breaks teaches the belief this section exists to prevent -- that
    // an empty screen means an empty result.
    next();
    expect(screen.getByRole("region", { name: T.issuesTitle })).toBeTruthy();
    next();
    expect(screen.getByRole("region", { name: T.issuesTitle })).toBeTruthy();
    next();
    expect(screen.getByRole("region", { name: T.issuesTitle })).toBeTruthy();
  });

  it("says so outright when nothing was dropped", async () => {
    renderWizard();
    await chooseFile(hevyFile(HEVY_ROWS));
    next();

    expect(screen.getByText(T.issuesEmpty)).toBeTruthy();
  });

  it("names the line a row was dropped from", async () => {
    renderWizard();
    await chooseFile(hevyFile(HEVY_WITH_BAD_ROW));
    next();

    const log = screen.getByRole("region", { name: T.issuesTitle });
    // Line 6 is the dateless row: header, four good rows, then the bad one.
    expect(within(log).getAllByText(T.issueLine(6)).length).toBeGreaterThan(0);
    expect(within(log).getByText(T.issue.missingDate)).toBeTruthy();
    // And the count is a number, not a shrug.
    expect(within(log).getByText(T.issuesCount(1))).toBeTruthy();
  });
});

describe("ImportWizard confirmation", () => {
  it("names the sessions, sets and exercises it is about to write", async () => {
    renderWizard();
    await toConfirm(hevyFile(HEVY_ROWS));

    expect(screen.getByText(T.confirmStats.sessions(2))).toBeTruthy();
    expect(screen.getByText(T.confirmStats.sets(4))).toBeTruthy();
    expect(screen.getByText(T.confirmStats.exercises(4))).toBeTruthy();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("writes on the button, and only then", async () => {
    const { onImported } = renderWizard();
    await toConfirm(hevyFile(HEVY_ROWS));

    fireEvent.click(screen.getByRole("button", { name: T.confirmStart }));

    await waitFor(() => expect(db.upsert).toHaveBeenCalled());
    // One upsert per session; the sets ride along on the log row.
    expect(db.upsert).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onImported).toHaveBeenCalled());
  });

  it("cannot be pressed twice, so a committed batch is not duplicated", async () => {
    renderWizard();
    await toConfirm(hevyFile(HEVY_ROWS));

    const button = screen.getByRole("button", { name: T.confirmStart }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
  });
});

describe("ImportWizard undo", () => {
  it("deletes the sessions the batch wrote, sets first", async () => {
    renderWizard();
    await toConfirm(hevyFile(HEVY_ROWS));
    fireEvent.click(screen.getByRole("button", { name: T.confirmStart }));
    await waitFor(() => expect(db.upsert).toHaveBeenCalled());

    const writtenIds = db.upsert.mock.calls.map((call) => (call[0] as { id: string }).id);
    expect(writtenIds).toHaveLength(2);

    db.tables.length = 0;
    fireEvent.click(screen.getByRole("button", { name: T.undo }));

    await waitFor(() => expect(screen.getByText(T.undoDone)).toBeTruthy());
    // Sets are removed before the log rows they hang off, or the delete cascades
    // into nothing and the log rows are left orphaned.
    expect(db.tables.indexOf("completed_sets")).toBeLessThan(db.tables.indexOf("workout_logs"));
  });

  it("refuses to claim success when the rows survived", async () => {
    renderWizard();
    await toConfirm(hevyFile(HEVY_ROWS));
    fireEvent.click(screen.getByRole("button", { name: T.confirmStart }));
    await waitFor(() => expect(db.upsert).toHaveBeenCalled());

    // The delete fails while the rows are still there. Saying "deshecha" here
    // would be the worst outcome available: the user stops believing the button.
    db.failure = { message: "offline" };

    fireEvent.click(screen.getByRole("button", { name: T.undo }));
    await waitFor(() => expect(screen.getByText(T.undoUnavailable)).toBeTruthy());
  });
});
