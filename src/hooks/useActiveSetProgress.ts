/**
 * useActiveSetProgress.ts — the running session's set progress, read
 * from the draft the workout screen persists.
 *
 * Why the draft and not context or Supabase: the workout screen owns
 * set completion in local state and mirrors it into IndexedDB on every
 * mutation (see `ActiveWorkout`). The dashboard is a different route,
 * so the only place that knows how many sets are done is that persisted
 * draft. Reading it here — on mount and whenever the session identity
 * changes — is enough, because navigating between `/entrenar` and
 * `/inicio` remounts this screen: the snapshot is fresh every time the
 * athlete actually looks at it, with no polling interval.
 *
 * The draft is matched on `startedAt` before it counts. A draft is the
 * *newest unfinished* one for the user, which after an abandoned session
 * is a different workout than the one the context says is running; two
 * sessions that both claim to be active would otherwise show each
 * other's progress. Same `startedAt` means same session, because the
 * draft stores the context's own `startedAt` verbatim.
 *
 * The counting itself is pure (`countSetProgress`) so the arithmetic is
 * testable without IndexedDB, which jsdom does not provide.
 */

import { useEffect, useState } from "react";
import { loadRecoverableDraft, type SessionDraft } from "@/lib/offlineStore";
import type { ActiveSession } from "@/context/ActiveSessionContext";

export interface ActiveSetProgress {
  /** Sets logged as completed in the current session. */
  doneSets: number;
  /** Total sets the session's plan asks for. */
  plannedSets: number;
}

const EMPTY: ActiveSetProgress = { doneSets: 0, plannedSets: 0 };

/**
 * Count completed and planned sets across a session draft.
 *
 * Pure, so the arithmetic is testable without IndexedDB. `null` (no
 * draft for this session) is all zeros rather than an error: a session
 * that has not opened its workout screen yet has done zero sets, and
 * zero is the honest answer.
 */
export function countSetProgress(
  draft: SessionDraft | null,
): ActiveSetProgress {
  if (!draft) return EMPTY;

  let doneSets = 0;
  let plannedSets = 0;
  for (const item of draft.items) {
    plannedSets += item.sets.length;
    for (const set of item.sets) {
      if (set.completed) doneSets += 1;
    }
  }
  return { doneSets, plannedSets };
}

/**
 * The current session's set progress, or zeros when there is no active
 * session or no draft for it.
 *
 * Reads the draft once per session identity. `userId` and `session` are
 * the only inputs; `session.startedAt` is the match key that keeps a
 * stale draft from being reported as this workout's progress.
 */
export function useActiveSetProgress(
  userId: string,
  session: ActiveSession | null,
): ActiveSetProgress {
  const [progress, setProgress] = useState<ActiveSetProgress>(EMPTY);
  const startedAt = session?.startedAt ?? null;

  useEffect(() => {
    if (!session || !startedAt) {
      setProgress(EMPTY);
      return;
    }

    let alive = true;
    void loadRecoverableDraft(userId).then((draft) => {
      if (!alive) return;
      const matched =
        draft && draft.startedAt === startedAt ? draft : null;
      setProgress(countSetProgress(matched));
    });

    return () => {
      alive = false;
    };
  }, [userId, session, startedAt]);

  return progress;
}
