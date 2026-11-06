// no imports needed

export type DayPlanStatus =
  | "pending"
  | "completed"
  | "not_done"
  | "in_progress"
  | "sync_pending"
  | "no_routine";

export interface DayPlanStatusInput {
  /** 0-based weekday index (Monday=0) of the day being evaluated. */
  dayIndex: number;
  /** Routine id programmed for this day, if any. */
  routineId: string | null;
  /** Current local date weekday index. */
  todayIndex: number;
  /** Whether the day's local date has ended (past day). */
  dayEnded: boolean;
  /** Whether there is an active/in-progress session for this routine. */
  hasActiveSession: boolean;
  /** Whether there is a recoverable draft for this routine. */
  hasRecoverableDraft: boolean;
  /** Whether a finalized-but-not-synced session exists for this routine on this day. */
  hasSyncPending: boolean;
  /** Whether a confirmed (server) session exists for this routine on this day. */
  hasConfirmedSession: boolean;
}

/**
 * Derives the status of a planned day from real data.
 * Pure function, no side effects, no persistence.
 */
export function deriveDayPlanStatus(input: DayPlanStatusInput): DayPlanStatus {
  if (!input.routineId) return "no_routine";
  if (input.hasActiveSession || input.hasRecoverableDraft) return "in_progress";
  if (input.hasSyncPending) return "sync_pending";
  if (input.hasConfirmedSession) return "completed";
  if (input.dayEnded && input.dayIndex !== input.todayIndex) return "not_done";
  return "pending";
}
