/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { SessionDraft } from "@/lib/offlineStore";
import type { Exercise } from "@/types/supabase";
import type { SetEntry } from "@/lib/workout/types";
import { countSetProgress, useActiveSetProgress } from "./useActiveSetProgress";

// The draft read is the one boundary this module does not own. jsdom has
// no IndexedDB, so the read is mocked here — the counting arithmetic is
// exercised against real shapes, not against a storage library.
const mockLoadDraft = vi.hoisted(() => vi.fn());

vi.mock("@/lib/offlineStore", () => ({
  loadRecoverableDraft: (...args: unknown[]) => mockLoadDraft(...args),
}));

const EXERCISE: Exercise = {
  id: "e-1",
  name: "Squat",
  body_part: "quads",
  target: "quadriceps",
  equipment: "barbell",
  gif_url: "",
  instructions: ["stand", "squat"],
};

function set(number: number, completed: boolean): SetEntry {
  return {
    set_number: number,
    weight: completed ? "100" : "",
    reps: completed ? "8" : "",
    rpe: "",
    kind: "normal",
    completed,
  };
}

function makeDraft(options: {
  startedAt: string;
  items: SetEntry[][];
}): SessionDraft {
  return {
    logId: "log-1",
    userId: "user-1",
    routineId: "r-1",
    routineTitle: "Full Body",
    startedAt: options.startedAt,
    items: options.items.map((sets, index) => ({
      key: `e-${index}`,
      exercise: EXERCISE,
      restSeconds: 90,
      sets,
    })),
    notes: "",
    finalized: false,
    updatedAt: 0,
  };
}

const RUNNING = {
  routineId: "r-1",
  title: "Full Body",
  startedAt: "2026-10-05T10:00:00",
};

describe("countSetProgress", () => {
  it("counts zero sets when there is no draft", () => {
    expect(countSetProgress(null)).toEqual({ doneSets: 0, plannedSets: 0 });
  });

  it("counts completed and planned sets across every exercise", () => {
    const draft = makeDraft({
      startedAt: RUNNING.startedAt,
      items: [
        [set(1, true), set(2, true), set(3, false)],
        [set(1, false), set(2, false)],
      ],
    });

    expect(countSetProgress(draft)).toEqual({ doneSets: 2, plannedSets: 5 });
  });

  it("counts a fully completed plan", () => {
    const draft = makeDraft({
      startedAt: RUNNING.startedAt,
      items: [[set(1, true), set(2, true)]],
    });

    expect(countSetProgress(draft)).toEqual({ doneSets: 2, plannedSets: 2 });
  });

  it("counts a plan with nothing completed yet", () => {
    const draft = makeDraft({
      startedAt: RUNNING.startedAt,
      items: [[set(1, false), set(2, false), set(3, false)]],
    });

    expect(countSetProgress(draft)).toEqual({ doneSets: 0, plannedSets: 3 });
  });
});

describe("useActiveSetProgress", () => {
  beforeEach(() => {
    mockLoadDraft.mockReset();
    mockLoadDraft.mockResolvedValue(null);
  });

  it("reads no draft and reports zeros when there is no session", () => {
    const { result } = renderHook(() =>
      useActiveSetProgress("user-1", null),
    );

    expect(result.current).toEqual({ doneSets: 0, plannedSets: 0 });
    expect(mockLoadDraft).not.toHaveBeenCalled();
  });

  it("counts the sets of the draft that matches the running session", async () => {
    mockLoadDraft.mockResolvedValue(
      makeDraft({
        startedAt: RUNNING.startedAt,
        items: [[set(1, true), set(2, false)]],
      }),
    );

    const { result } = renderHook(() =>
      useActiveSetProgress("user-1", RUNNING),
    );

    await waitFor(() =>
      expect(result.current).toEqual({ doneSets: 1, plannedSets: 2 }),
    );
    expect(mockLoadDraft).toHaveBeenCalledWith("user-1");
  });

  it("ignores a draft left by a different session", async () => {
    // A stale draft from an abandoned session: same user, but its
    // startedAt is not the running session's.
    mockLoadDraft.mockResolvedValue(
      makeDraft({
        startedAt: "2026-10-04T09:00:00",
        items: [[set(1, true), set(2, true), set(3, true)]],
      }),
    );

    const { result } = renderHook(() =>
      useActiveSetProgress("user-1", RUNNING),
    );

    await waitFor(() => expect(mockLoadDraft).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(result.current).toEqual({ doneSets: 0, plannedSets: 0 });
  });

  it("reports zeros when the draft read finds nothing", async () => {
    mockLoadDraft.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useActiveSetProgress("user-1", RUNNING),
    );

    await waitFor(() => expect(mockLoadDraft).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(result.current).toEqual({ doneSets: 0, plannedSets: 0 });
  });
});
