/**
 * useOfflineSync.ts — connectivity state plus background queue draining.
 *
 * Drains on three triggers, which covers the realistic recovery paths:
 *   - the browser fires `online` after wifi comes back in the gym
 *   - the tab regains visibility (the user switched back to the app)
 *   - a slow interval, so a session queued while the network was flapping
 *     eventually lands without any user action
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { queueLength } from "../lib/offlineStore";
import { drainQueue, type SyncResult } from "../lib/sessionSync";

/** How often to retry while online. Offline is event-driven, not polled. */
const DRAIN_INTERVAL_MS = 60_000;

export type SyncStatus = "idle" | "syncing" | "offline" | "pending" | "error";

export interface OfflineSyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  status: SyncStatus;
  /** Last failure worth showing, cleared on a successful drain. */
  error: string | null;
  /** Manual retry, used by the sync badge. */
  syncNow: () => Promise<void>;
}

export function useOfflineSync(enabled = true): OfflineSyncState {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Guards against overlapping drains: the interval and the `online` event can
  // both fire, and two concurrent drains would write the same session twice.
  const inFlight = useRef(false);

  const refreshPending = useCallback(async () => {
    setPending(await queueLength());
  }, []);

  const runDrain = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      const result: SyncResult = await drainQueue();
      setPending(await queueLength());
      if (result.failed > 0) {
        setError(result.errors[0] ?? "No se pudo sincronizar");
      } else if (result.succeeded > 0) {
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de sincronización");
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      setOnline(true);
      void runDrain();
    };
    const handleOffline = () => setOnline(false);

    const handleVisible = () => {
      if (document.visibilityState === "visible") void runDrain();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);

    const timer = window.setInterval(() => {
      if (navigator.onLine) void runDrain();
    }, DRAIN_INTERVAL_MS);

    // Anything already queued from a previous session goes up on mount.
    if (navigator.onLine) void runDrain();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
      window.clearInterval(timer);
    };
  }, [enabled, runDrain]);

  const status: SyncStatus = syncing
    ? "syncing"
    : !online
      ? "offline"
      : pending > 0
        ? "pending"
        : error
          ? "error"
          : "idle";

  return { online, syncing, pending, status, error, syncNow: runDrain };
}