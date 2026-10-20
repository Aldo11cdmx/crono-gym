/**
 * @vitest-environment jsdom
 *
 * ExerciseHubHeader is the top of the exercise hub. It owns two things that need
 * guarding:
 *
 *  1. The back-to-session button and the session clock only appear when there is
 *     a running session, and the clock keeps ticking from `useElapsedMs`.
 *  2. Chips render when provided, and the whole row disappears when there are none.
 *  3. Compact mode on scroll: the title collapses to icon-only, the clock becomes
 *     digits-only, and the tab strip takes over as the visual anchor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ExerciseHubHeader, type HubChip } from "./ExerciseHubHeader";
import * as ActiveSessionModule from "@/context/ActiveSessionContext";
import { HUB_LABELS } from "@/lib/i18n";

const NO_SESSION = {
  session: null,
  isActive: false,
  start: vi.fn(),
  end: vi.fn(),
  warmups: [],
  enqueueWarmup: vi.fn(),
  resolveWarmup: vi.fn(),
  recoverableDraft: null,
  rehydrating: false,
  rehydrate: vi.fn(),
  restoreDraft: vi.fn(),
  discardDraft: vi.fn(),
  recoveredLogId: null,
};

const SESSION = {
  session: { routineId: "r1", title: "Push Pull Legs", startedAt: "2026-01-01T11:59:45Z" },
  isActive: true,
  start: vi.fn(),
  end: vi.fn(),
  warmups: [],
  enqueueWarmup: vi.fn(),
  resolveWarmup: vi.fn(),
  recoverableDraft: null,
  rehydrating: false,
  rehydrate: vi.fn(),
  restoreDraft: vi.fn(),
  discardDraft: vi.fn(),
  recoveredLogId: null,
};

describe("ExerciseHubHeader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z").getTime());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the exercise name", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(NO_SESSION);

    const { getByText } = render(<ExerciseHubHeader exerciseName="Press de banca" />);
    expect(getByText("Press de banca")).toBeTruthy();
  });

  it("shows back button and session clock when a session is active", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(SESSION);

    const { getByText, getByRole } = render(
      <ExerciseHubHeader exerciseName="Press de banca" onBack={() => {}} />,
    );

    expect(getByText(HUB_LABELS.backToSession)).toBeTruthy();
    expect(getByText(HUB_LABELS.sessionRunning)).toBeTruthy();
    expect(getByText("00:15")).toBeTruthy();
    const backButton = getByRole("button", { name: new RegExp(HUB_LABELS.backToSession, "i") });
    expect(backButton).toBeTruthy();
  });

  it("hides back button and session clock when no session is active", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(NO_SESSION);

    const { queryByText, queryByRole } = render(<ExerciseHubHeader exerciseName="Press de banca" />);
    expect(queryByText(HUB_LABELS.backToSession)).toBeNull();
    expect(queryByText(HUB_LABELS.sessionRunning)).toBeNull();
    expect(queryByRole("button", { name: /Volver/i })).toBeNull();
  });

  it("calls onBack when the back button is clicked", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(SESSION);

    const onBack = vi.fn();
    const { getByRole } = render(
      <ExerciseHubHeader exerciseName="Press de banca" onBack={onBack} />,
    );
    const backButton = getByRole("button", { name: new RegExp(HUB_LABELS.backToSession, "i") });
    backButton.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("session clock ticks as time advances", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(SESSION);

    const { getByText } = render(<ExerciseHubHeader exerciseName="Press de banca" />);

    expect(getByText("00:15")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(getByText("00:16")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(getByText("00:21")).toBeTruthy();
  });

  it("renders chips when provided", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(NO_SESSION);

    const chips: HubChip[] = [
      { id: "rank", label: "Sobresaliente" },
      { id: "trend", label: "Subiendo", tone: "up" },
      { id: "note", label: "Sin notas", tone: "down" },
    ];

    const { getByText, getByRole } = render(
      <ExerciseHubHeader exerciseName="Press de banca" chips={chips} />,
    );

    expect(getByText("Sobresaliente")).toBeTruthy();
    expect(getByText("Subiendo")).toBeTruthy();
    expect(getByText("Sin notas")).toBeTruthy();
    expect(getByRole("group")).toBeTruthy();
  });

  it("omits the chip row when chips is empty", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(NO_SESSION);

    const { queryByRole } = render(
      <ExerciseHubHeader exerciseName="Press de banca" chips={[]} />,
    );
    expect(queryByRole("group")).toBeNull();
  });

  it("omits the chip row when chips is undefined", () => {
    vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(NO_SESSION);

    const { queryByRole } = render(<ExerciseHubHeader exerciseName="Press de banca" />);
    expect(queryByRole("group")).toBeNull();
  });

  describe("compact mode on scroll", () => {
    beforeEach(() => {
      vi.spyOn(ActiveSessionModule, "useActiveSession").mockReturnValue(SESSION);
    });

    it("hides the title when scrolled past the threshold", () => {
      const { queryByText, getByText } = render(
        <ExerciseHubHeader exerciseName="Press de banca" />,
      );

      expect(getByText("Press de banca")).toBeTruthy();

      vi.spyOn(window, "scrollY", "get").mockReturnValue(100);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(queryByText("Press de banca")).toBeNull();
    });

    it("shows icon-only back button in compact mode", () => {
      const { queryByText } = render(
        <ExerciseHubHeader exerciseName="Press de banca" onBack={() => {}} />,
      );

      expect(queryByText(HUB_LABELS.backToSession)).toBeTruthy();

      vi.spyOn(window, "scrollY", "get").mockReturnValue(100);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(queryByText(HUB_LABELS.backToSession)).toBeNull();
    });

    it("shows clock without the running label in compact mode", () => {
      const { getByText, queryByText } = render(
        <ExerciseHubHeader exerciseName="Press de banca" />,
      );

      expect(getByText(HUB_LABELS.sessionRunning)).toBeTruthy();
      expect(getByText("00:15")).toBeTruthy();

      vi.spyOn(window, "scrollY", "get").mockReturnValue(100);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
      });
      expect(queryByText(HUB_LABELS.sessionRunning)).toBeNull();
      expect(getByText("00:15")).toBeTruthy();
    });
  });
});
