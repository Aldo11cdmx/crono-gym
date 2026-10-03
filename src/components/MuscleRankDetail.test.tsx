/**
 * @vitest-environment jsdom
 *
 * MuscleRankDetail is the one piece of the ranks UI that is a modal, so it is the
 * one piece whose behaviour is mostly about focus and keyboard rather than
 * arithmetic. These tests cover that contract:
 *
 *  - focus moves into the dialog on open and returns to the opener on close;
 *  - Escape closes, backdrop clicks close, clicks inside do not;
 *  - Tab is trapped, so focus cannot wander into the inert map behind it;
 *  - the derivation is actually shown, and an unranked muscle says why.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MuscleRankDetail } from "./MuscleRankDetail";
import { buildRankMap, type MuscleRank } from "../lib/ranks/buildRankMap";
import type { ExerciseRow, SetRow } from "../lib/ranks/muscleScore";
import { rankById, VOLUME_RULES } from "../lib/ranks/rankConfig";
import type { RankHistoryRecord } from "../lib/ranks/rankHistory";
import { RANK_LABELS as T } from "../lib/i18n";

const NOW = new Date("2026-06-01T12:00:00.000Z");

const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "row", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
];

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function chestHistory(sessions = 14): SetRow[] {
  return Array.from({ length: sessions }, (_, i) => ({
    exerciseId: "press",
    weight: 90 + i,
    reps: 5,
    isWarmup: false,
    performedAt: daysAgo(i * 3),
  }));
}

/** A classified chest entry, straight out of the real scorer. */
function trainedEntry(): MuscleRank {
  const map = buildRankMap({
    sets: chestHistory(),
    exercises: EXERCISES,
    context: { bodyweightKg: 80, sex: "male", now: NOW },
  });
  return map.muscles.get("chest")!;
}

/** A muscle with no data, so the unranked branch is exercised for real. */
function emptyEntry(): MuscleRank {
  const map = buildRankMap({
    sets: [],
    exercises: EXERCISES,
    context: { bodyweightKg: 80, sex: "male", now: NOW },
  });
  return map.muscles.get("chest")!;
}

const HISTORY: RankHistoryRecord[] = [
  { id: "chest|bronze|2026-04-01", slug: "chest", rank: "bronze", score: 14, recordedAt: daysAgo(61), day: "2026-04-01" },
  { id: "chest|silver|2026-05-01", slug: "chest", rank: "silver", score: 31, recordedAt: daysAgo(31), day: "2026-05-01" },
  { id: "chest|gold|2026-06-01", slug: "chest", rank: "gold", score: 49, recordedAt: daysAgo(0), day: "2026-06-01" },
];

afterEach(cleanup);

describe("MuscleRankDetail", () => {
  it("is exposed as a modal dialog named after the muscle", () => {
    render(
      <MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("muscle-rank-title");
    expect(screen.getByRole("heading", { name: /Pecho/i })).toBeTruthy();
  });

  it("moves focus into the dialog and returns it to the opener on unmount", () => {
    const opener = document.createElement("button");
    opener.textContent = "abrir";
    document.body.append(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(
      <MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />,
    );
    expect(document.activeElement).not.toBe(opener);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("closes on Escape and on a backdrop click", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MuscleRankDetail entry={trainedEntry()} history={[]} onClose={onClose} />,
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // The backdrop is the dialog's parent; a click there is a dismiss.
    fireEvent.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<MuscleRankDetail entry={trainedEntry()} history={[]} onClose={onClose} />);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("wraps Tab around the panel instead of escaping to the page behind it", () => {
    render(<MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />);
    const dialog = screen.getByRole("dialog");
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    const last = focusables[focusables.length - 1];
    const first = focusables[0];
    last.focus();

    // Forward from the last element must land back on the first.
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // And backward from the first must land on the last.
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("shows the score, the derivation and the next rank for a classified muscle", () => {
    const entry = trainedEntry();
    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);

    expect(screen.getByText(String(entry.score))).toBeTruthy();
    expect(screen.getByText(entry.rank.label)).toBeTruthy();
    expect(screen.getByText(/Fuerza/)).toBeTruthy();
    expect(screen.getByText(/Volumen/)).toBeTruthy();
    // The scorer's own contributions, not a hand-written summary. Now also named
    // by the 1RM section, so the assertion is that it appears at all rather than
    // that it appears once.
    expect(screen.getAllByText("Press de banca").length).toBeGreaterThan(0);
  });

  it("reports the gap to the next rank when there is one", () => {
    const entry = trainedEntry();
    expect(entry.progress.next).not.toBeNull();
    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);
    // Scoped to the sentence, because the progress bar's accessible name names
    // the same rank -- and the bar's name is checked separately below.
    expect(
      screen.getByText(new RegExp(`te faltan ${entry.progress.pointsToNext} puntos`, "i")),
    ).toBeTruthy();
  });

  it("exposes the progress bar's value to assistive technology", () => {
    const entry = trainedEntry();
    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe(
      String(Math.round(entry.progress.percent * 100)),
    );
    expect(bar.getAttribute("aria-label")).toContain(entry.progress.next!.label);
  });

  it("says it is at the top of the ladder when there is no rank above", () => {
    // Forced rather than engineered: waiting for a real Obsidian muscle in a
    // fixture would make this test depend on the scorer's calibration.
    const entry = trainedEntry();
    const top = { ...entry, rank: rankById("obsidian"), progress: { ...entry.progress, next: null, pointsToNext: 0 } };
    render(<MuscleRankDetail entry={top} history={[]} onClose={() => undefined} />);
    expect(screen.getByText(/rango más alto/i)).toBeTruthy();
  });

  it("explains why an unranked muscle has no rank instead of showing a score", () => {
    const entry = emptyEntry();
    expect(entry.classified).toBe(false);
    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);

    expect(screen.getByText(/Sin datos todavía/)).toBeTruthy();
    // No progress bar: a bar toward a rank the muscle has not earned is a lie.
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("lists the rank timeline newest first, in Spanish, and says so when it is empty", () => {
    const { rerender } = render(
      <MuscleRankDetail entry={trainedEntry()} history={HISTORY} onClose={() => undefined} />,
    );
    // Scoped by name: the panel also lists exercise contributions, which are
    // `listitem`s too.
    const rows = within(screen.getByRole("list", { name: "Historial de rangos" })).getAllByRole(
      "listitem",
    );
    const text = rows.map((r) => r.textContent ?? "");
    expect(text[0]).toContain("Oro");
    expect(text[0]).toContain("2026-06-01");
    expect(text[text.length - 1]).toContain("Bronce");
    // The stored ids are never rendered raw.
    expect(text.join(" ")).not.toMatch(/bronze|silver|gold/);

    rerender(<MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />);
    expect(screen.getByText(/Aún no hay historial/)).toBeTruthy();
  });

  it("does not pretend a single recorded rank is a trend", () => {
    render(
      <MuscleRankDetail entry={trainedEntry()} history={[HISTORY[0]]} onClose={() => undefined} />,
    );
    expect(screen.getByText(/Primer rango registrado/)).toBeTruthy();
  });

  it("offers the catalog handoff only when the parent can handle it", () => {
    const onBrowse = vi.fn();
    const { rerender } = render(
      <MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />,
    );
    expect(screen.queryByRole("button", { name: /Ver ejercicios/i })).toBeNull();

    rerender(
      <MuscleRankDetail
        entry={trainedEntry()}
        history={[]}
        onClose={() => undefined}
        onBrowseExercises={onBrowse}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver ejercicios/i }));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });
});

/**
 * The three things the panel was computing and never showing.
 *
 * `decayFactor`, `daysSinceLastSet` and `bestSet` were all produced by the scorer,
 * typed, documented and asserted in `muscleScore.test.ts` -- and rendered nowhere.
 * A muscle decaying for three months looked exactly like one trained yesterday, and
 * the 1RM was an unsourced number the user had to take on faith.
 *
 * Every fixture below is a real `buildRankMap` result rather than a hand-built
 * `MuscleRank`, so these tests fail if the panel's claims drift from the scorer's.
 */
describe("MuscleRankDetail score breakdown", () => {
  it("states each half's share of the score, not just its percentage", () => {
    // "Fuerza 68%" on its own reads as "68% of the score is strength", which is
    // not what the engine computes. The weight is the part that was missing.
    render(<MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />);

    expect(screen.getByText(T.strengthWeight)).toBeTruthy();
    expect(screen.getByText(T.volumeWeight)).toBeTruthy();
    expect(T.strengthWeight).toBe("70% del puntaje");
    expect(T.volumeWeight).toBe("30% del puntaje");
  });

  it("names the real percentages the scorer produced", () => {
    const entry = trainedEntry();
    render(<MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />);

    expect(
      screen.getByText(`${Math.round(entry.detail.strength!.volumePercent)}%`),
    ).toBeTruthy();
    expect(
      screen.getByText(`${Math.round(entry.detail.volume.volumePercent)}%`),
    ).toBeTruthy();
  });
});

describe("MuscleRankDetail estimated 1RM", () => {
  it("shows the set the number came from, with the arithmetic worked through", () => {
    const entry = trainedEntry();
    render(<MuscleRankDetail entry={trainedEntry()} history={[]} onClose={() => undefined} />);

    expect(screen.getByText(T.oneRepMaxTitle)).toBeTruthy();
    expect(screen.getByText(T.oneRepMaxFormula)).toBeTruthy();

    const best = [...entry.detail.contributions].sort(
      (a, b) => b.estimatedOneRepMax - a.estimatedOneRepMax,
    )[0];
    // The figure on screen and the figure behind the rank are the same number.
    expect(screen.getByText(`${best.estimatedOneRepMax.toFixed(1)} kg`)).toBeTruthy();
    expect(
      screen.getByText(
        T.oneRepMaxFormulaHint(
          best.bestSet!.weight,
          best.bestSet!.reps,
          best.estimatedOneRepMax,
        ),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(T.oneRepMaxBestSet(best.bestSet!.weight, best.bestSet!.reps)),
    ).toBeTruthy();
  });

  it("says so plainly when no set can support an estimate", () => {
    // Forced rather than engineered: a classified muscle always has at least one
    // contribution, so the scorer cannot produce this state. The panel still has to
    // survive it -- a zero-weight set yields a 0 estimated 1RM, and "0.0 kg 1RM"
    // reads as a measurement of nothing.
    const entry = trainedEntry();
    const noEstimate: MuscleRank = {
      ...entry,
      detail: {
        ...entry.detail,
        contributions: entry.detail.contributions.map((c) => ({
          ...c,
          estimatedOneRepMax: 0,
          bestSet: null,
        })),
      },
    };

    render(<MuscleRankDetail entry={noEstimate} history={[]} onClose={() => undefined} />);
    expect(screen.getByText(T.oneRepMaxNoSet)).toBeTruthy();
    expect(screen.queryByText(/0\.0 kg/)).toBeNull();
  });
});

describe("MuscleRankDetail inactivity decay", () => {
  /** Real history whose most recent set is `idleDays` old. */
  function entryIdleFor(idleDays: number): MuscleRank {
    const sets: SetRow[] = Array.from({ length: 8 }, (_, i) => ({
      exerciseId: "press",
      weight: 90,
      reps: 5,
      isWarmup: false,
      // Eight sessions ending `idleDays` ago.
      performedAt: daysAgo(idleDays + i * 4),
    }));
    const map = buildRankMap({
      sets,
      exercises: EXERCISES,
      context: { bodyweightKg: 80, sex: "male", now: NOW },
    });
    return map.muscles.get("chest")!;
  }

  it("stays quiet for a muscle trained inside the grace period", () => {
    // An indicator on every muscle would be noise on the common case.
    const entry = entryIdleFor(10);
    expect(entry.detail.volume.decayFactor).toBe(1);

    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);
    expect(screen.getByText(T.decayNone)).toBeTruthy();
    expect(screen.queryByText(/al \d+% por no entrenar/)).toBeNull();
  });

  it("says so once the muscle has been idle past the threshold, with the cause", () => {
    const entry = entryIdleFor(VOLUME_RULES.decayAfterDays + 30);
    expect(entry.detail.volume.decayFactor).toBeLessThan(1);
    expect(entry.detail.volume.daysSinceLastSet).toBeGreaterThan(VOLUME_RULES.decayAfterDays);

    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);

    const percent = Math.round(entry.detail.volume.decayFactor * 100);
    // The whole sentence, because the duration and the multiplier share one node:
    // asserting them apart would pass even if the panel had swapped their order.
    expect(
      screen.getByText(
        `${T.decayDays(VOLUME_RULES.decayAfterDays + 30)} · ${T.decayLost(percent)}`,
      ),
    ).toBeTruthy();
  });

  it("never claims a decay for a muscle with no history at all", () => {
    const entry = emptyEntry();
    expect(entry.detail.volume.daysSinceLastSet).toBeNull();

    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);
    // "0 days since your last set" would be a lie about a muscle never trained.
    expect(screen.queryByText(/Última serie hace/)).toBeNull();
  });

  it("drops the indicator again once the muscle is trained", () => {
    // The decay is a property of the history, not a latch on the panel.
    const entry = trainedEntry();
    expect(entry.detail.volume.decayFactor).toBe(1);

    render(<MuscleRankDetail entry={entry} history={[]} onClose={() => undefined} />);
    expect(screen.getByText(T.decayNone)).toBeTruthy();
  });
});