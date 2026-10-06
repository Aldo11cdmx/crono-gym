/**
 * useHubChips.ts — the header's quick read, derived rather than stored.
 *
 * These chips are not a summary that anyone writes: every one of them is computed from the
 * same data the tab below it will show, so the header and the tab can never disagree. An
 * athlete reading "+2.4 kg/mes" in the header and then a flat line in the chart has been
 * told two things, and they will believe the one that took less scrolling.
 *
 * That is also why a chip that cannot be computed is *omitted* rather than shown as zero or
 * blank. "No trend yet" and "no progress" are different claims, and only the first one is
 * true for someone who has trained the movement once.
 */

import { useMemo } from "react";
import { estimateTrend } from "@/lib/exercise/exerciseMetrics";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";
import type { HubChip } from "@/components/hub/ExerciseHubHeader";

/**
 * Turns a per-session rate into a per-month one.
 *
 * `estimateTrend` returns kg *per session* because that is what the sessions support, and
 * `+0.8 kg/sesión` is true and unreadable -- the unit a training plan is written in is
 * kg/month. The multiplication is an assumption about frequency, which is why the label
 * carries the unit: a wrong assumption should be visible rather than disguised.
 */
export const ASSUMED_SESSIONS_PER_MONTH = 12;

/**
 * Rounds a monthly rate to a number a person would say.
 *
 * `0.37` is not a figure anyone thinks in, and this chip is read in under a second. Two
 * decimals is the line: below it the number is noise, above it the chip stops fitting.
 *
 * Uses `−` (U+2212) for the minus rather than a hyphen, because it aligns with the digits
 * in the mono run and a hyphen in a numeric label reads as a dash at small sizes.
 */
export function formatKgPerMonth(kgPerMonth: number, unit: string): string {
  const rounded = Math.round(kgPerMonth * 100) / 100;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded)} ${unit}/mes`;
}

export interface UseHubChipsOptions {
  /** Newest-first, which is the order `groupBySession` returns. */
  sessions: readonly ExerciseSession[];
  /** The display unit, so a chip in lb never sits above a chart in kg. */
  unit: "kg" | "lb";
  /** Converts a kg value into the display unit. Supplied, not imported: the rule already exists. */
  convert: (kg: number) => number;
}

export function useHubChips({ sessions, unit, convert }: UseHubChipsOptions): HubChip[] {
  return useMemo(() => {
    const trend = estimateTrend(sessions);
    if (!trend || trend.direction === "flat") return [];

    const perMonth = convert(trend.kgPerSession * ASSUMED_SESSIONS_PER_MONTH);
    return [
      {
        id: "trend",
        glyph: trend.direction === "up" ? "📈" : "📉",
        label: formatKgPerMonth(perMonth, unit),
        tone: trend.direction === "up" ? "up" : "down",
      },
    ];
  }, [sessions, unit, convert]);
}