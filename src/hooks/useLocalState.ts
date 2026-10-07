/**
 * useLocalState.ts — reactive read of the device-local state row.
 *
 * The row lives in IndexedDB and this is the only way a component reaches it.
 * The hook wraps {@link loadLocalState} / {@link saveLocalState} and exposes
 * the same contract the rest of the app uses: `loading`, an `error` that is
 * never thrown, and a `save` that returns whether it took.
 *
 * It does not own the row's *shape* — that is `localState.ts`'s job — and it
 * does not own normalisation, which is `featureFlags.ts`'s job. This hook's
 * only concern is "is the row here, and can I write to it".
 */

import { useCallback, useEffect, useState } from "react";
import {
  clearLocalState,
  loadLocalState,
  saveLocalState,
  type LocalStateRow,
} from "@/lib/profile/localState";

export interface LocalStateState {
  row: LocalStateRow | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (patch: Partial<Omit<LocalStateRow, "key">>) => Promise<boolean>;
  clear: () => Promise<boolean>;
}

export function useLocalState(): LocalStateState {
  const [row, setRow] = useState<LocalStateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [refresh]);

  const save = useCallback(
    async (patch: Partial<Omit<LocalStateRow, "key">>): Promise<boolean> => {
      setError(null);
      try {
        const next = await saveLocalState(patch);
        if (next) setRow(next);
        return next !== null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        return false;
      }
    },
    [],
  );

  const clear = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      await clearLocalState();
      setRow(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    }
  }, []);

  return { row, loading, error, refresh, save, clear };
}