/**
 * @vitest-environment jsdom
 *
 * RecordBadge.test.tsx — the one notification in the app that interrupts.
 *
 * Two things have to hold, and they pull against each other:
 *
 *   1. It must go away on its own. A record badge that stays is a badge covering the set
 *      logger, on the screen the athlete is using most.
 *   2. It must not take its confirmation with it. Under reduced motion the travel goes and
 *      the notification stays — a PR nobody is told about is the one outcome this component
 *      cannot produce.
 *
 * The dismissal is timed internally rather than left to a parent to clear, so the tests here
 * drive the clock instead of asserting on a prop somebody has to remember to pass.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RecordBadge } from "./RecordBadge";


afterEach(cleanup);

/**
 * The reduced-motion seam, as a plain `vi.fn` closed over by the factory.
 *
 * `vi.mocked(realHook)` would be typing the wrapper rather than the mock, and the wrapper has
 * no `mockReturnValue`. The factory is only called when the module is first imported, which
 * is after this binding exists.
 */
const reducedMotionMock = vi.fn(() => false);

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotionMock(),
}));

beforeEach(() => {
  reducedMotionMock.mockReturnValue(false);
  vi.useFakeTimers();
});

const NOTICE = { id: "pr-1", title: "Nuevo récord de press de banca: 100 kg" };

describe("RecordBadge", () => {
  it("renders nothing when there is no record", () => {
    const { container } = render(<RecordBadge notice={null} />);
    expect(container.textContent).toBe("");
  });

  it("announces itself, because this is the one interruption worth making", () => {
    render(<RecordBadge notice={NOTICE} />);
    const alert = screen.getByRole("alert");
    expect(alert.getAttribute("aria-label")).toMatch(/Nuevo récord/i);
  });

  it("clears itself after the timeout", () => {
    render(<RecordBadge notice={NOTICE} />);
    expect(screen.getByRole("alert")).toBeTruthy();

    // Just before the dismiss: still up, because unmounting on the same tick would make it
    // blink rather than leave.
    act(() => void vi.advanceTimersByTime(3999));
    expect(screen.getByRole("alert")).toBeTruthy();

    act(() => void vi.advanceTimersByTime(1));
    expect((screen.getByRole("alert") as HTMLElement).dataset.leaving).toBe("true");

    // And gone once the exit transition has run.
    act(() => void vi.advanceTimersByTime(250));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("can be dismissed by hand immediately", () => {
    render(<RecordBadge notice={NOTICE} />);

    fireEvent.click(screen.getByRole("button", { name: /Cerrar el aviso/i }));
    // No exit wait: the athlete asked for it to go, so it goes.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stops travelling but still tells the athlete when motion is reduced", () => {
    reducedMotionMock.mockReturnValue(true);
    render(<RecordBadge notice={NOTICE} />);

    const card = screen.getByRole("alert");
    // The confirmation survives; only the movement is cancelled. The animation class is what
    // `index.css` cancels for `prefers-reduced-motion`.
    expect(card.className).not.toContain("cronos-record-pop");
    expect(card.getAttribute("style")).toContain("opacity: 1");

    act(() => void vi.advanceTimersByTime(4001));
    // Reduced motion skips the exit entirely rather than sitting invisible for 250ms.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts the timer when the record arrives, not when it settles", () => {
    const { rerender } = render(<RecordBadge notice={NOTICE} />);

    // A re-render mid-display must not restart the four seconds, which would leave the badge
    // up indefinitely for exactly the athlete whose next set triggers a re-render.
    act(() => void vi.advanceTimersByTime(3000));
    rerender(<RecordBadge notice={{ ...NOTICE }} />);
    act(() => void vi.advanceTimersByTime(1000));

    expect((screen.getByRole("alert") as HTMLElement).dataset.leaving).toBe("true");
  });

  it("re-fires for a different record", () => {
    const { rerender } = render(<RecordBadge notice={NOTICE} />);
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<RecordBadge notice={{ id: "pr-2", title: "Nuevo récord de sentadilla: 140 kg" }} />);
    expect(screen.getByRole("alert").textContent).toMatch(/sentadilla/);
  });
});