/**
 * @vitest-environment jsdom
 *
 * `GymSettingsTrigger` is the only route from the screens that matter into the
 * gym settings. If it silently stops opening, nothing in the app looks broken --
 * the stepper just quietly keeps suggesting loads this gym cannot build -- so the
 * failures pinned here are the ones with no other symptom.
 *
 * The state lives in the trigger rather than in each host, which is the property
 * these tests defend: a second host cannot ship a gear that opens a dialog whose
 * close handler is wired to the wrong screen.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GymSettingsTrigger } from "./GymSettingsTrigger";
import { GymSettingsProvider } from "@/context/GymSettingsContext";
import { GYM_LABELS } from "@/lib/i18n";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

function renderTrigger() {
  return render(
    <GymSettingsProvider>
      <GymSettingsTrigger />
    </GymSettingsProvider>,
  );
}

function gear(): HTMLElement {
  return screen.getByRole("button", { name: GYM_LABELS.triggerAriaLabel(GYM_LABELS.defaultTriggerContext) });
}

describe("GymSettingsTrigger", () => {
  it("renders no dialog until asked", () => {
    renderTrigger();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("announces itself as opening a dialog", () => {
    renderTrigger();
    expect(gear().getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("opens the panel on tap", () => {
    renderTrigger();
    fireEvent.click(gear());
    expect(screen.getByRole("dialog", { name: GYM_LABELS.title })).toBeTruthy();
  });

  it("closes from the panel's own done button", () => {
    renderTrigger();
    fireEvent.click(gear());
    fireEvent.click(screen.getByText(GYM_LABELS.done));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when the backdrop is tapped", () => {
    // The backdrop is the only dismissal the modal offers besides "Listo", and
    // `GymSettingsModal` has no Escape handler on purpose. It is the dialog's
    // grandparent: the panel stops propagation, so a click that reaches it is a
    // click inside, and must not close anything.
    renderTrigger();
    fireEvent.click(gear());
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(dialog.parentElement?.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reopens after a close, rather than latching shut", () => {
    renderTrigger();
    fireEvent.click(gear());
    fireEvent.click(screen.getByText(GYM_LABELS.done));
    fireEvent.click(gear());
    expect(screen.getByRole("dialog", { name: GYM_LABELS.title })).toBeTruthy();
  });

  it("writes changes through to the stored rack", () => {
    // The whole reason the gear exists: a tap here must change what the stepper
    // is allowed to offer, not just what the panel draws.
    renderTrigger();
    fireEvent.click(gear());
    fireEvent.click(screen.getByRole("button", { name: "lb" }));
    fireEvent.click(screen.getByText(GYM_LABELS.done));

    const stored = window.localStorage.getItem("cronos:gymSettings");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string).weightUnit).toBe("lb");
  });

  it("names the host screen, so two gears are not announced identically", () => {
    render(
      <GymSettingsProvider>
        <GymSettingsTrigger context="en tu perfil" />
      </GymSettingsProvider>,
    );
    expect(
      screen.getByRole("button", { name: GYM_LABELS.triggerAriaLabel("en tu perfil") }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: GYM_LABELS.triggerAriaLabel(GYM_LABELS.defaultTriggerContext),
      }),
    ).toBeNull();
  });
});
