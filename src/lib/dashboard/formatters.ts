/**
 * formatters.ts — display helpers for dashboard data.
 *
 * Pure functions: each takes a value and returns a string. No locale, no
 * timezone, no hidden state. The locale is injected so tests can pin output
 * and the component layer stays decoupled from `window`/`navigator`.
 */

import type { UnitSystem } from "../profile";

/**
 * Format a `YYYY-M-D` local date key into a weekday label ("Mon", "Wed", …)
 * in the provided locale. The key is parsed as local midnight.
 */
export function formatDateKey(key: string, locale: string): string {
  const parts = key.split("-").map(Number);
  if (parts.length !== 3) return key;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, { weekday: "short" });
}

/**
 * Format a `YYYY-M-D` local date key into a medium date ("5 Oct 2026" in
 * en-GB, "Oct 5, 2026" in en-US) in the provided locale.
 */
export function formatDateMedium(key: string, locale: string): string {
  const parts = key.split("-").map(Number);
  if (parts.length !== 3) return key;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date key as a range relative to `now`:
 *   - "Today" when the key is today's local date.
 *   - "Yesterday" when the key is yesterday.
 *   - "5 days ago" otherwise.
 */
export function formatDateRelative(key: string, locale: string, now: number): string {
  const parts = key.split("-").map(Number);
  if (parts.length !== 3) return key;
  const [y, m, d] = parts;
  const day = new Date(y, m - 1, d);
  day.setHours(0, 0, 0, 0);

  const nowDate = new Date(now);
  nowDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((nowDate.getTime() - day.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 0) return formatDateMedium(key, locale);

  if (diffDays <= 7) return `${diffDays} days ago`;
  if (diffDays <= 30) {
    const weeks = Math.round(diffDays / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  return formatDateMedium(key, locale);
}

/** Human-readable delta percentage: "+10.5%" / "-5%" / "—" when null. */
export function formatDelta(deltaPct: number | null): string {
  if (deltaPct === null) return "—";
  const sign = deltaPct >= 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}%`;
}

/** Convert kilograms to the target display unit. */
export function formatWeight(kg: number, unitSystem: UnitSystem): string {
  if (unitSystem === "imperial") {
    return `${Math.round(kg * 2.20462)} lb`;
  }
  return `${Math.round(kg)} kg`;
}

/** Convert a kilograms-per-rep 1RM estimate to display units. */
export function formatOneRepMax(kg: number, unitSystem: UnitSystem): string {
  return formatWeight(kg, unitSystem);
}

/** Format a number with thousands separators, e.g. `12500` → `"12,500"`. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Format a duration in seconds to `mm:ss` or `h:mm:ss` for longer sets.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
