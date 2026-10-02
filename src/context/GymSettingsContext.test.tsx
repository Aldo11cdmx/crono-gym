/**
 * @vitest-environment jsdom
 *
 * The point of this file is that `localStorage` is shared mutable state that
 * survives between page loads and is *not* covered by the type checker. A
 * `Partial<GymSettings>` spread will happily write `{barType: "olympic"}` with a
 * missing inventory, a typo'd key, or a count of `-1`, and the app will read it
 * back on the next launch. So the tests are mostly about hostile input.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import {
  DEFAULT_GYM_SETTINGS,
  GYM_INVENTORY,
  GYM_SETTINGS_KEY,
  GymSettingsProvider,
  useGymSettings,
  type GymSettings,
} from "./GymSettingsContext";
import { BAR_WEIGHTS } from "../lib/workout/weightUtils";

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

/** Renders the provider and hands the consumer back to the test. */
function mountGymSettings() {
  let latest: ReturnType<typeof useGymSettings> | null = null;

  function Probe() {
    latest = useGymSettings();
    return null;
  }

  render(
    <GymSettingsProvider>
      <Probe />
    </GymSettingsProvider>,
  );

  // The provider renders synchronously, so this is never null in practice.
  if (!latest) throw new Error("probe did not render");
  return latest as ReturnType<typeof useGymSettings>;
}

/** Re-mounts on whatever is currently in storage, as a page reload would. */
function reload() {
  cleanup();
  return mountGymSettings();
}

function stored(): string | null {
  return window.localStorage.getItem(GYM_SETTINGS_KEY);
}

describe("GymSettings defaults", () => {
  it("starts on an olympic bar with the gym's official plate scale", () => {
    const settings = mountGymSettings();
    expect(settings.barType).toBe("olympic");
    expect(settings.barKg).toBe(BAR_WEIGHTS.olympic);
    expect(settings.inventory).toEqual(GYM_INVENTORY);
    expect(settings.useHalfPlates).toBe(false);
    expect(settings.weightUnit).toBe("kg");
  });

  it("stocks strictly 2.5, 5, 10, 15 and 20 kg plates", () => {
    // The official scale. A 25 or a 1.25 here would make the stepper suggest
    // weights this gym cannot load.
    expect(Object.keys(mountGymSettings().inventory).map(Number).sort((a, b) => a - b)).toEqual([
      2.5, 5, 10, 15, 20,
    ]);
  });

  it("treats a custom bar as zero until a weight is given", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ barType: "custom" }));
    expect(reload().barKg).toBe(0);
  });

  it("uses the custom weight once one is set", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ barType: "custom", customBarKg: 12.5 }));
    expect(reload().barKg).toBe(12.5);
  });
});

describe("GymSettings persistence", () => {
  it("writes to the namespaced cronos:gymSettings key", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ barType: "standard" }));
    expect(stored()).not.toBeNull();
    expect(JSON.parse(stored() ?? "{}")).toMatchObject({ barType: "standard" });
  });

  it("survives a reload", () => {
    const settings = mountGymSettings();
    act(() =>
      settings.updateSettings({
        barType: "ez",
        customBarKg: 7,
        useHalfPlates: true,
        weightUnit: "lb",
      }),
    );

    const reloaded = reload();
    expect(reloaded.barType).toBe("ez");
    expect(reloaded.customBarKg).toBe(7);
    expect(reloaded.useHalfPlates).toBe(true);
    expect(reloaded.weightUnit).toBe("lb");
    expect(reloaded.barKg).toBe(BAR_WEIGHTS.ez);
  });

  it("persists an edited inventory, not just the flags", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ inventory: { 20: 4, 15: 1, 10: 1 } }));
    expect(reload().inventory).toEqual({ 20: 4, 15: 1, 10: 1 });
  });

  it("overwrites rather than merging into the previous payload", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ inventory: { 20: 4 } }));
    act(() => settings.updateSettings({ weightUnit: "lb" }));

    const stored_ = JSON.parse(stored() ?? "{}") as GymSettings;
    // A naive deep merge would have kept the four 20s *and* the gym scale.
    expect(stored_.inventory).toEqual({ 20: 4 });
  });

  it("resets to the gym defaults", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ barType: "hex", weightUnit: "lb" }));
    act(() => settings.resetSettings());
    expect(reload()).toMatchObject({
      barType: "olympic",
      inventory: GYM_INVENTORY,
      weightUnit: "kg",
    });
  });
});

describe("GymSettings half plates", () => {
  it("adds the 1.25 and 0.5 change plates when switched on", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ useHalfPlates: true }));
    expect(reload().inventory).toEqual({ ...GYM_INVENTORY, 1.25: 2, 0.5: 2 });
  });

  it("takes them back off again, so a stale payload cannot leave phantom plates", () => {
    const settings = mountGymSettings();
    act(() => settings.updateSettings({ useHalfPlates: true }));
    act(() => settings.updateSettings({ useHalfPlates: false }));
    expect(reload().inventory).toEqual(GYM_INVENTORY);
  });

  it("strips change plates from storage even if the flag is off", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ useHalfPlates: false, inventory: { 20: 2, 1.25: 2, 0.5: 2 } }),
    );
    expect(reload().inventory).toEqual({ 20: 2 });
  });
});

describe("GymSettings hostile storage", () => {
  it("falls back to the defaults on malformed JSON", () => {
    window.localStorage.setItem(GYM_SETTINGS_KEY, "{not json");
    expect(reload()).toMatchObject(DEFAULT_GYM_SETTINGS);
  });

  it("falls back to the defaults when the payload is not an object", () => {
    window.localStorage.setItem(GYM_SETTINGS_KEY, '"a string"');
    expect(reload()).toMatchObject(DEFAULT_GYM_SETTINGS);
  });

  it("starts from the defaults when the key is absent", () => {
    expect(stored()).toBeNull();
    expect(reload()).toMatchObject(DEFAULT_GYM_SETTINGS);
  });

  it("drops an unrecognised bar type but keeps the rest", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ barType: "trapbar", weightUnit: "lb" }),
    );
    const settings = reload();
    expect(settings.barType).toBe("olympic");
    expect(settings.weightUnit).toBe("lb");
  });

  it("drops an unrecognised unit but keeps the rest", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ weightUnit: "stone", barType: "standard" }),
    );
    const settings = reload();
    expect(settings.weightUnit).toBe("kg");
    expect(settings.barType).toBe("standard");
  });

  it("rejects plate counts that could never exist", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({
        inventory: { 20: -4, 15: 1.5, 10: "two", 5: null, 2.5: 3 },
      }),
    );
    // 1.5 is dropped too: a fractional pair of plates is not a thing.
    expect(reload().inventory).toEqual({ 2.5: 3 });
  });

  it("rejects an inventory that survives filtering empty", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ inventory: { 20: 0, 15: -1 } }),
    );
    expect(reload().inventory).toEqual(GYM_INVENTORY);
  });

  it("rejects a negative custom bar weight", () => {
    window.localStorage.setItem(GYM_SETTINGS_KEY, JSON.stringify({ customBarKg: -20 }));
    expect(reload().customBarKg).toBe(0);
  });

  it("rejects a non-finite custom bar weight", () => {
    window.localStorage.setItem(
      GYM_SETTINGS_KEY,
      JSON.stringify({ customBarKg: null, barType: "standard" }),
    );
    const settings = reload();
    expect(settings.customBarKg).toBe(0);
    expect(settings.barType).toBe("standard");
  });
});

describe("useGymSettings outside a provider", () => {
  it("returns the gym defaults instead of throwing", () => {
    function Bare() {
      const settings = useGymSettings();
      return <span data-testid="bar">{settings.barKg}</span>;
    }
    const { getByTestId } = render(<Bare />);
    // A component that must not render without a provider still has to render.
    expect(getByTestId("bar").textContent).toBe(String(BAR_WEIGHTS.olympic));
  });
});
