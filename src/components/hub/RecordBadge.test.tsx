/**
 * @vitest-environment jsdom
 *
 * RecordBadge.test.tsx — the four-second "new record" toast, its auto-dismiss,
 * and the confirmation beep that ships with it.
 *
 * The beep lives in `@/lib/audio` as a lazily-created AudioContext singleton. Tests
 * mock that module so the assertions are about the component calling `playBeep`
 * at the right moment (and not calling it when it shouldn't), not about the
 * Web Audio API working inside jsdom.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, act, fireEvent, render } from "@testing-library/react";

vi.mock("@/lib/audio", () => ({
  playBeep: vi.fn(),
  resetAudioContext: vi.fn(),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockReducedMotion,
}));

import { playBeep } from "@/lib/audio";
import { RecordBadge, type RecordNotice } from "@/components/hub/RecordBadge";
import { HUB_RECORDS_LABELS } from "@/lib/i18n";

let mockReducedMotion: boolean;

function renderBadge(notice: RecordNotice | null, props?: { autoDismissMs?: number }) {
  return render(
    <RecordBadge notice={notice} autoDismissMs={props?.autoDismissMs} />,
  );
}

const TEST_NOTICE: RecordNotice = {
  id: "record-1",
  title: "Press de banca — 100 kg",
};

describe("RecordBadge", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when notice is null", () => {
    const { container } = renderBadge(null);
    expect(container.firstChild).toBeNull();
  });

  it("renders the record title when a notice is provided", () => {
    mockReducedMotion = false;
    const { getByText } = renderBadge(TEST_NOTICE);
    expect(getByText(TEST_NOTICE.title)).toBeTruthy();
  });

  it("plays a beep when the badge appears", () => {
    mockReducedMotion = false;
    renderBadge(TEST_NOTICE);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });

  it("does not play a beep when reduced motion is on", () => {
    mockReducedMotion = true;
    renderBadge(TEST_NOTICE);
    expect(playBeep).not.toHaveBeenCalled();
  });

  it("does not play a beep when notice is null", () => {
    mockReducedMotion = false;
    renderBadge(null);
    expect(playBeep).not.toHaveBeenCalled();
  });

  it("uses role=alert for screen readers", () => {
    mockReducedMotion = false;
    const { getByRole } = renderBadge(TEST_NOTICE);
    expect(getByRole("alert")).toBeTruthy();
  });

  it("sets the aria-label from the record title", () => {
    mockReducedMotion = false;
    const { getByRole } = renderBadge(TEST_NOTICE);
    const alert = getByRole("alert");
    expect(alert.getAttribute("aria-label")).toBe(
      HUB_RECORDS_LABELS.badgeAriaLabel(TEST_NOTICE.title),
    );
  });

  it("shows a dismiss button with the correct aria-label", () => {
    mockReducedMotion = false;
    const { getByRole } = renderBadge(TEST_NOTICE);
    expect(getByRole("button", { name: HUB_RECORDS_LABELS.badgeDismissAriaLabel })).toBeTruthy();
  });

  it("hides the badge immediately when the dismiss button is clicked", () => {
    mockReducedMotion = true;
    const { getByRole, queryByRole } = renderBadge(TEST_NOTICE);
    fireEvent.click(getByRole("button", { name: HUB_RECORDS_LABELS.badgeDismissAriaLabel }));
    expect(queryByRole("alert")).toBeNull();
  });

  it("auto-dismisses after the configured ms with reduced motion", () => {
    mockReducedMotion = true;
    vi.useFakeTimers();
    const { queryByRole } = renderBadge(TEST_NOTICE, { autoDismissMs: 1000 });

    expect(queryByRole("alert")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Reduced motion: EXIT_MS=0, so the second timeout fires immediately
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(queryByRole("alert")).toBeNull();
    vi.useRealTimers();
  });

  it("transitions to leaving state before unmounting with animation", () => {
    mockReducedMotion = false;
    vi.useFakeTimers();
    const { getByRole } = renderBadge(TEST_NOTICE, { autoDismissMs: 1000 });

    const alert = getByRole("alert");
    expect(alert.getAttribute("data-leaving")).toBe("false");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // After the first timeout, leaving is true but still mounted (EXIT_MS pending)
    expect(alert.getAttribute("data-leaving")).toBe("true");

    vi.useRealTimers();
  });

  it("does not play another beep for a new record with a different id", () => {
    mockReducedMotion = false;
    const { rerender } = renderBadge(TEST_NOTICE);
    expect(playBeep).toHaveBeenCalledTimes(1);

    rerender(<RecordBadge notice={{ id: "record-2", title: "Another record" }} />);
    expect(playBeep).toHaveBeenCalledTimes(2);
  });

  it("does not play another beep for a re-render with the same notice id", () => {
    mockReducedMotion = false;
    const { rerender } = renderBadge(TEST_NOTICE);
    expect(playBeep).toHaveBeenCalledTimes(1);

    rerender(<RecordBadge notice={TEST_NOTICE} />);
    expect(playBeep).toHaveBeenCalledTimes(1);
  });

  it("plays a fresh beep when a new record id arrives after dismissal", () => {
    mockReducedMotion = false;
    vi.useFakeTimers();

    const { rerender } = renderBadge(TEST_NOTICE, { autoDismissMs: 1000 });
    expect(playBeep).toHaveBeenCalledTimes(1);

    // Auto-dismiss the first badge: first timeout (1000ms), then EXIT_MS for unmount
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // A new record arrives
    rerender(
      <RecordBadge notice={{ id: "record-2", title: "New record" }} autoDismissMs={1000} />,
    );
    expect(playBeep).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
