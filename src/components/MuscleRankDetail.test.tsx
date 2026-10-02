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
import { rankById } from "../lib/ranks/rankConfig";
import type { RankHistoryRecord } from "../lib/ranks/rankHistory";

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
    // The scorer's own contributions, not a hand-written summary.
    expect(screen.getByText("Press de banca")).toBeTruthy();
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