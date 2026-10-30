/**
 * athleteNotes.ts — the single parser for `coach_session_requests.athlete_notes`.
 *
 * The column holds a JSON string written by `RequestRoutineModal`'s
 * `buildFullRequestPayload` (keys: objetivo, dias_semana, nivel_experiencia,
 * equipo, molestias_lesiones, notas_adicionales). Older rows may carry free
 * text instead.
 *
 * Kept here rather than inline in `RequestQueue` and `AthleteDetailView`
 * because both read the same column and both used to disagree about its shape:
 * the queue parsed JSON, the detail view ran a regex looking for `Objetivo:`
 * and so always showed "Sin dato" for a request that had every field filled in.
 */

export interface AthleteNotesParsed {
  objetivo?: string;
  dias_semana?: string | number;
  nivel_experiencia?: string;
  equipo?: string;
  molestias_lesiones?: string;
  notas_adicionales?: string;
  /** Raw text fallback when the column is not JSON. */
  text?: string;
}

/**
 * Parses `athlete_notes` into typed fields.
 *
 * Returns an object with `text` set when the column is free text, so callers
 * that only care about the summary can fall back to it.
 */
export function parseAthleteNotes(raw: string | null | undefined): AthleteNotesParsed {
  if (!raw || !raw.trim()) return { text: "" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AthleteNotesParsed;
    }
  } catch {
    // not JSON — fall through to the text path
  }
  return { text: raw.trim() };
}

/** Best-effort human label for a phase slug. */
export function phaseLabelFor(
  phase: string | null | undefined,
  labels: { deload: string; maintenance: string; overload: string; unknown: string },
): string {
  if (!phase) return labels.unknown;
  if (phase === "deload") return labels.deload;
  if (phase === "maintenance") return labels.maintenance;
  if (phase === "overload") return labels.overload;
  return phase;
}