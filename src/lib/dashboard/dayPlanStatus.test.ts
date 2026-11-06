import { describe, it, expect } from "vitest";
import { deriveDayPlanStatus } from "./dayPlanStatus";

describe("deriveDayPlanStatus", () => {
  const base = {
    dayIndex: 1,
    routineId: "r1",
    todayIndex: 1,
    dayEnded: false,
    hasActiveSession: false,
    hasRecoverableDraft: false,
    hasSyncPending: false,
    hasConfirmedSession: false,
  };

  it("no routine → no_routine", () => {
    expect(deriveDayPlanStatus({ ...base, routineId: null })).toBe("no_routine");
  });

  it("active session → in_progress", () => {
    expect(deriveDayPlanStatus({ ...base, hasActiveSession: true })).toBe("in_progress");
  });

  it("recoverable draft → in_progress", () => {
    expect(deriveDayPlanStatus({ ...base, hasRecoverableDraft: true })).toBe("in_progress");
  });

  it("sync pending → sync_pending (not not_done)", () => {
    expect(deriveDayPlanStatus({ ...base, dayEnded: true, dayIndex: 0, todayIndex: 1, hasSyncPending: true })).toBe("sync_pending");
  });

  it("confirmed session → completed", () => {
    expect(deriveDayPlanStatus({ ...base, hasConfirmedSession: true })).toBe("completed");
  });

  it("past day no session → not_done", () => {
    expect(deriveDayPlanStatus({ ...base, dayIndex: 0, todayIndex: 1, dayEnded: true })).toBe("not_done");
  });

  it("today no session → pending", () => {
    expect(deriveDayPlanStatus({ ...base })).toBe("pending");
  });

  it("future day → pending", () => {
    expect(deriveDayPlanStatus({ ...base, dayIndex: 5, todayIndex: 1 })).toBe("pending");
  });
});
