import type { RoutineDraftV2 } from "./routineDayModel";

export type SaveOrigin = "editor" | "planner" | "rename" | "duplicate" | "restore" | "retry" | "day_zero";
export type SaveState = "idle" | "saving" | "dirty" | "error";

export interface SaveJob {
  draftKey: string;
  routineId: string | null;
  draft: RoutineDraftV2;
  generation: number;
  origin: SaveOrigin;
}

export type SaveProcessor = (job: SaveJob) => Promise<boolean>;

export interface RoutineSaveQueue {
  enqueue(job: SaveJob): void;
  flush(key: string): Promise<boolean>;
  state(key: string): SaveState;
  subscribe(key: string, listener: (state: SaveState) => void): () => void;
}

export function createRoutineSaveQueue(process: SaveProcessor): RoutineSaveQueue {
  const states = new Map<string, SaveState>();
  const listeners = new Map<string, Set<(s: SaveState) => void>>();
  const pending = new Map<string, SaveJob>();
  const processing = new Set<string>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function execKey(job: SaveJob): string {
    return job.routineId ?? `draft:${job.draftKey}`;
  }

  function setState(key: string, s: SaveState) {
    states.set(key, s);
    const ls = listeners.get(key);
    if (ls) for (const l of ls) l(s);
  }

  async function processJob(draftKey: string): Promise<boolean> {
    const job = pending.get(draftKey);
    if (!job) return true;
    if (processing.has(draftKey)) return true;
    processing.add(draftKey);
    pending.delete(draftKey);

    const ek = execKey(job);
    try {
      setState(ek, "saving");
      const ok = await process(job);
      setState(ek, ok ? "idle" : "error");
      return ok;
    } catch {
      setState(ek, "error");
      return false;
    } finally {
      processing.delete(draftKey);
    }
  }

  return {
    enqueue(job) {
      const existing = pending.get(job.draftKey);
      if (existing && existing.generation >= job.generation) return;
      pending.set(job.draftKey, job);
      setState(execKey(job), "dirty");

      const existingTimer = debounceTimers.get(job.draftKey);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        debounceTimers.delete(job.draftKey);
        void processJob(job.draftKey);
      }, 800);
      debounceTimers.set(job.draftKey, timer);
    },
    async flush(key: string): Promise<boolean> {
      const draftKey = [...pending.entries()].find(([, j]) => execKey(j) === key)?.[0];
      if (!draftKey) return true;
      const timer = debounceTimers.get(draftKey);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(draftKey);
      }
      return processJob(draftKey);
    },
    state(key) {
      return states.get(key) ?? "idle";
    },
    subscribe(key, listener) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(listener);
      return () => listeners.get(key)?.delete(listener);
    },
  };
}
