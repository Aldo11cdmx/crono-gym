/**
 * @vitest-environment jsdom
 *
 * The pill is the only thing that tells a user their workout is still running
 * after they have navigated away from it. Everything here is about that one
 * promise: show it exactly when a session exists and the screen is not already
 * the workout, and never show a stale time or a stale name.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { ActiveWorkoutPill, formatElapsed, truncateRoutineName } from "./ActiveWorkoutPill";
import { ActiveSessionProvider, useActiveSession } from "@/context/ActiveSessionContext";

afterEach(cleanup);

/**
 * Starts a session on mount, so a test can describe the state it is asserting
 * against instead of reaching into the provider's internals.
 *
 * The ref guard is load-bearing: without it the effect would re-run whenever the
 * provider re-rendered and reset `startedAt` to the present, leaving the elapsed
 * time permanently `00:00`.
 */
function StartSession({ title = "Pecho y hombro", id = "r-1" }: { title?: string; id?: string }) {
  const { start } = useActiveSession();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start({ id, title });
  }, [start, id, title]);
  return null;
}

function renderPill({
  path = "/",
  title = "Pecho y hombro",
  withSession = true,
}: {
  path?: string;
  title?: string;
  withSession?: boolean;
}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ActiveSessionProvider>
        {withSession ? <StartSession title={title} /> : null}
        <ActiveWorkoutPill />
      </ActiveSessionProvider>
    </MemoryRouter>,
  );
}

describe("ActiveWorkoutPill", () => {
  it("renders nothing when there is no active session", () => {
    renderPill({ path: "/", withSession: false });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders as a polite live region once a session exists", () => {
    renderPill({ path: "/" });

    const pill = screen.getByRole("status");
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.tagName).toBe("BUTTON");
  });

  it("renders when a session exists and the screen is not the workout", () => {
    renderPill({ path: "/rangos" });
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("stays hidden on the training route, where the workout already fills the screen", () => {
    renderPill({ path: "/entrenar" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("names the routine in the visible text and in the accessible name", () => {
    renderPill({ path: "/", title: "Pierna y glúteo" });

    expect(screen.getByText("Pierna y glúteo")).toBeDefined();
    expect(screen.getByRole("status").getAttribute("aria-label")).toContain(
      "Pierna y glúteo",
    );
  });

  it("truncates a long routine name to 20 visible characters", () => {
    const long = "Programa de hipertrofia de tren inferior";
    renderPill({ path: "/", title: long });

    // Truncated in the pixels...
    expect(screen.getByText(truncateRoutineName(long))).toBeDefined();
    expect(screen.queryByText(long)).toBeNull();
    // ...but not in the accessible name, which has no pixel budget.
    expect(screen.getByRole("status").getAttribute("aria-label")).toContain(long);
  });

  it("shows elapsed time that advances with the clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    try {
      const { unmount } = render(
        <MemoryRouter initialEntries={["/"]}>
          <ActiveSessionProvider>
            <StartSession title="Pecho" />
            <ActiveWorkoutPill />
          </ActiveSessionProvider>
        </MemoryRouter>,
      );

      expect(screen.getByRole("status").textContent).toContain("00:00");

      // Advancing the fake clock advances `Date.now()` and fires the interval in
      // one step. Setting the system time *and* advancing would move both, which
      // is where the extra second in an earlier version of this test came from.
      act(() => {
        vi.advanceTimersByTime(90_000);
      });
      expect(screen.getByRole("status").textContent).toContain("01:30");

      // Unmount with the fake clock still installed: this is where a leaked
      // interval shows up, as an assertion after the test rather than a failure
      // inside it.
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("pill formatting", () => {
  it("clips a name to 20 characters including the ellipsis", () => {
    expect(truncateRoutineName("Pecho")).toBe("Pecho");
    expect(truncateRoutineName("a".repeat(20))).toBe("a".repeat(20));
    expect(truncateRoutineName("a".repeat(21))).toBe(`${"a".repeat(19)}…`);
    expect(truncateRoutineName("a".repeat(21))).toHaveLength(20);
  });

  it("formats elapsed time as MM:SS and does not cap the minutes", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(9_000)).toBe("00:09");
    expect(formatElapsed(90_000)).toBe("01:30");
    expect(formatElapsed(3 * 60 * 60 * 1000)).toBe("180:00");
  });

  it("treats a clock that went backwards as zero rather than negative time", () => {
    expect(formatElapsed(-5_000)).toBe("00:00");
  });
});