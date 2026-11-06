/**
 * trainingIntent.ts — pure resolver for training start/continue/restore decisions (P1.3).
 *
 * Priority (authoritative):
 * 1. rehydrating → wait
 * 2. recoverable draft → restore (explicit recovery beats session state created during rehydrate)
 * 3. active session → continue
 * 4. no session/draft → start if target valid
 */

export interface TrainingIntentSession {
  routineId: string | null;
  title: string | null;
}

export interface TrainingIntentDraft {
  routineId: string | null;
  routineTitle?: string | null;
}

export type TrainingIntent =
  | { action: "wait"; reason: "rehydrating" }
  | {
      action: "continue";
      reason: "same_routine" | "different_routine";
      routineId: string | null;
      routineTitle: string | null;
    }
  | {
      action: "restore";
      reason: "same_routine" | "different_routine";
      routineId: string | null;
      routineTitle: string | null;
    }
  | {
      action: "start";
      routineId: string | null;
      routineTitle: string | null;
    }
  | { action: "blocked"; reason: "invalid_target" };

export interface ResolveTrainingIntentInput {
  rehydrating: boolean;
  session: TrainingIntentSession | null;
  recoverableDraft: TrainingIntentDraft | null;
  targetRoutineId: string | null | undefined;
  targetRoutineTitle?: string | null;
  allowFreeStart?: boolean;
}

function sameRoutine(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

export function resolveTrainingIntent(input: ResolveTrainingIntentInput): TrainingIntent {
  const {
    rehydrating,
    session,
    recoverableDraft,
    targetRoutineId,
    targetRoutineTitle = null,
    allowFreeStart = true,
  } = input;

  if (rehydrating) return { action: "wait", reason: "rehydrating" };

  if (recoverableDraft) {
    const draftRoutineId = recoverableDraft.routineId ?? null;
    const same = sameRoutine(draftRoutineId, targetRoutineId ?? null);
    return {
      action: "restore",
      reason: same ? "same_routine" : "different_routine",
      routineId: draftRoutineId,
      routineTitle: recoverableDraft.routineTitle ?? null,
    };
  }

  if (session) {
    const same = sameRoutine(session.routineId ?? null, targetRoutineId ?? null);
    return {
      action: "continue",
      reason: same ? "same_routine" : "different_routine",
      routineId: session.routineId ?? null,
      routineTitle: session.title ?? null,
    };
  }

  const targetId = targetRoutineId ?? null;
  if (targetId == null && !allowFreeStart) {
    return { action: "blocked", reason: "invalid_target" };
  }
  return { action: "start", routineId: targetId, routineTitle: targetRoutineTitle };
}
