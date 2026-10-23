/**
 * useAthleteContext.ts — the single hook that reads and writes the athlete
 * context fields held in `localState`.
 *
 * The athlete context is the set of fields the coach sees: goal, body metrics,
 * experience, days per week, equipment, injuries, and the AI-consent switch.
 * The body metrics themselves live on the server (`profiles.weight_kg`,
 * `profiles.height_cm`, `profiles.goal`, `profiles.experience_level`) and are
 * owned by `useProfile`. This hook owns only the *local* additions: the
 * injury note, the days-per-week count, and the consent switch -- plus the
 * glue that tells the preamble builder where to read the rest.
 *
 * One hook, one seam. Two hooks reaching for the same row is how a row ends
 * up half-migrated and half-corrupt, and the failure is silent because every
 * reader normalises what it finds.
 *
 * The save is debounced by the caller's choice of timing; this hook exposes a
 * raw `save` that bumps `contextRevision`, and a `schedule` that coalesces
 * rapid writes into one IndexedDB round trip. The debounce constant lives here
 * because it is a behaviour of the seam, not of the form.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLocalState,
  loadLocalState,
  saveLocalState,
  type LocalStateRow,
} from "@/lib/profile/localState";
import { sanitizeFreeText } from "@/lib/profile/validation";

/** How long a burst of writes waits before hitting IndexedDB. */
export const AUTOSAVE_DEBOUNCE_MS = 400;

export interface AthleteContextState {
  row: LocalStateRow | null;
  loading: boolean;
  error: string | null;
  /** Bumped on every successful save so a caller can detect change. */
  revision: number;
  save: (patch: Partial<Omit<LocalStateRow, "key">>) => Promise<boolean>;
  refresh: () => Promise<void>;
  clear: () => Promise<boolean>;
  schedule: (patch: Partial<Omit<LocalStateRow, "key">>) => void;
}

/**
 * Reads the local state row and exposes a debounced writer.
 *
 * `schedule` coalesces calls within `AUTOSAVE_DEBOUNCE_MS` into one write and
 * bumps `revision` when it lands, so a parent that keys on `revision` re-renders
 * exactly once per burst rather than once per keystroke.
 */
export function useAthleteContext(): AthleteContextState {
  const [row, setRow] = useState<LocalStateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // The pending patch is held in a ref so the timeout closure always reads the
  // latest value without needing `schedule` in its dependency array.
  const pendingRef = useRef<Partial<Omit<LocalStateRow, "key">> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadLocalState();
      setRow(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const save = useCallback(
    async (patch: Partial<Omit<LocalStateRow, "key">>): Promise<boolean> => {
      setError(null);
      // The injury note is free text and the one field that reaches a prompt,
      // so it is sanitised here rather than at the call site. A caller that
      // passes already-sanitised text is unaffected: sanitising twice is a
      // no-op on a string that has already been cleaned.
      if (patch.context?.injuries !== undefined) {
        patch = {
          ...patch,
          context: {
            ...(patch.context ?? row?.context ?? { daysPerWeek: null, injuries: "" }),
            injuries: sanitizeFreeText(patch.context.injuries),
          },
        };
      }
      try {
        const next = await saveLocalState(patch);
        if (next) {
          setRow(next);
          setRevision((r) => r + 1);
        }
        return next !== null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        return false;
      }
    },
    [row],
  );

  const schedule = useCallback(
    (patch: Partial<Omit<LocalStateRow, "key">>) => {
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const current = pendingRef.current;
        pendingRef.current = null;
        timerRef.current = null;
        if (current) void save(current);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [save],
  );

  // Flush the pending write when the component unmounts, so a keystroke that
  // leaves the screen is not lost to the debounce timer.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const current = pendingRef.current;
      pendingRef.current = null;
      if (current) void save(current);
    },
    [save],
  );

  const clear = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      await clearLocalState();
      setRow(null);
      setRevision((r) => r + 1);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    }
  }, []);

  return { row, loading, error, revision, save, refresh, clear, schedule };
}