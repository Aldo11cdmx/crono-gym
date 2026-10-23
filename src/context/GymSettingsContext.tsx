/**
 * GymSettingsContext.tsx — the rack this user actually trains in.
 *
 * Why this is local and not in the `profiles` row: the plate inventory and bar
 * type describe the *equipment*, not the person. Two people share a gym, and
 * their answers to "do you have 1.25 kg plates" can differ on the same afternoon.
 * It is also the one setting that must exist before sign-in -- the weight stepper
 * has to know what it can load while onboarding is still running.
 *
 * Why `localStorage` rather than IndexedDB like `offlineStore`: these are a
 * handful of scalars read on the first paint of the set logger. Async storage
 * would mean a frame where the stepper does not know the bar weight.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BAR_WEIGHTS, type BarType, type PlateInventory, type PlateKg } from "../lib/workout/weightUtils";

/**
 * Storage key. Namespaced with the product so it cannot collide with the Supabase
 * client's own `sb-*-auth-token` entries.
 */
export const GYM_SETTINGS_KEY = "cronos:gymSettings";

export type WeightUnit = "kg" | "lb";

export interface GymSettings {
  /** Which bar the user loads by default. */
  barType: BarType;
  /**
   * Weight of the `custom` bar, for a fixed dumbbell or a smith-machine bar that
   * is not in {@link BAR_WEIGHTS}. Only consulted when `barType` is `"custom"`.
   */
  customBarKg: number;
  /** Plates on hand, in **pairs per side**. */
  inventory: PlateInventory;
  /**
   * Whether the 1.25 and 0.5 kg change plates are in the rack.
   *
   * Off by default: most gyms do not have them, and a stepper that offers 62.5 kg
   * to someone whose smallest plate is 2.5 kg is telling them a lie they will
   * discover standing at the rack.
   */
  useHalfPlates: boolean;
  /** Unit the user reads and types weights in. */
  weightUnit: WeightUnit;
}

/**
 * The gym's official plate scale, strictly: 2.5, 5, 10, 15 and 20 kg.
 *
 * Two pairs of each is a full commercial plate tree -- enough per side to build
 * any realistic working set without running out of 20s.
 */
export const GYM_PLATE_SCALE: readonly PlateKg[] = [2.5, 5, 10, 15, 20];

export const GYM_INVENTORY: PlateInventory = {
  2.5: 2,
  5: 2,
  10: 2,
  15: 2,
  20: 2,
};

/** Pairs per side of the change plates that `useHalfPlates` unlocks. */
const CHANGE_PLATE_PAIRS = 2;
const CHANGE_PLATE_SIZES: readonly PlateKg[] = [1.25, 0.5];

export const DEFAULT_GYM_SETTINGS: GymSettings = {
  barType: "olympic",
  customBarKg: BAR_WEIGHTS.custom,
  inventory: GYM_INVENTORY,
  useHalfPlates: false,
  weightUnit: "kg",
};

const BAR_TYPES: readonly BarType[] = ["olympic", "standard", "ez", "hex", "custom"];
const PLATE_SIZES: readonly PlateKg[] = [0.5, 1.25, 2.5, 5, 10, 15, 20, 25];

function isBarType(value: unknown): value is BarType {
  return typeof value === "string" && (BAR_TYPES as readonly string[]).includes(value);
}

function isWeightUnit(value: unknown): value is WeightUnit {
  return value === "kg" || value === "lb";
}

/**
 * Keeps only the plate sizes the type knows about, and only counts that could
 * exist. A hand-edited `localStorage` entry with `{"0": 4, "2.5": "two"}` must
 * degrade to a usable rack, not to a NaN plate calculation.
 */
function toInventory(value: unknown): PlateInventory | null {
  if (typeof value !== "object" || value === null) return null;

  const source = value as Record<string, unknown>;
  const inventory: PlateInventory = {};
  for (const size of PLATE_SIZES) {
    const count = source[String(size)];
    if (typeof count === "number" && Number.isInteger(count) && count > 0) {
      inventory[size] = count;
    }
  }
  return Object.keys(inventory).length > 0 ? inventory : null;
}

/**
 * Merges the change plates in or out of an inventory.
 *
 * Applied on read as well as on write, so a payload saved while half plates were
 * on cannot leave phantom 1.25s on the rack after the user switches them off.
 */
function applyHalfPlates(inventory: PlateInventory, enabled: boolean): PlateInventory {
  const next: PlateInventory = { ...inventory };
  for (const size of CHANGE_PLATE_SIZES) {
    if (enabled) {
      next[size] = inventory[size] ?? CHANGE_PLATE_PAIRS;
    } else {
      delete next[size];
    }
  }
  return next;
}

/**
 * Reads persisted settings, field by field.
 *
 * Per-field rather than all-or-nothing, so one unrecognised value costs the user
 * that setting and not their whole rack. Anything unreadable falls back to the
 * defaults, because a corrupt entry must never keep the app from starting.
 */
function parseSettings(raw: string | null): GymSettings {
  if (!raw) return DEFAULT_GYM_SETTINGS;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return DEFAULT_GYM_SETTINGS;
  }
  if (typeof payload !== "object" || payload === null) return DEFAULT_GYM_SETTINGS;

  const source = payload as Record<string, unknown>;
  const barType = isBarType(source.barType) ? source.barType : DEFAULT_GYM_SETTINGS.barType;

  const customBarKg =
    typeof source.customBarKg === "number" &&
    Number.isFinite(source.customBarKg) &&
    source.customBarKg >= 0
      ? source.customBarKg
      : DEFAULT_GYM_SETTINGS.customBarKg;

  const inventory = toInventory(source.inventory) ?? DEFAULT_GYM_SETTINGS.inventory;
  const useHalfPlates =
    typeof source.useHalfPlates === "boolean"
      ? source.useHalfPlates
      : DEFAULT_GYM_SETTINGS.useHalfPlates;

  return {
    barType,
    customBarKg,
    inventory: applyHalfPlates(inventory, useHalfPlates),
    useHalfPlates,
    weightUnit: isWeightUnit(source.weightUnit) ? source.weightUnit : DEFAULT_GYM_SETTINGS.weightUnit,
  };
}

/**
 * Reads storage defensively.
 *
 * `localStorage` throws rather than returning null in a Safari private window and
 * when a browser blocks site data, and both are ordinary states, not errors worth
 * crashing a workout over.
 */
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota or blocked storage. The session keeps working from memory; the
    // settings simply will not survive a reload.
  }
}

export interface GymSettingsValue extends GymSettings {
  /** The bar weight in kg for the configured bar, custom weight included. */
  barKg: number;
  /**
   * The inventory with sub-2.5 kg change plates removed unless they are on.
   *
   * This is what every consumer should pass to the plate maths.
   */
  loadableInventory: PlateInventory;
  updateSettings: (patch: Partial<GymSettings>) => void;
  /** Discards the stored settings and returns to the gym defaults. */
  resetSettings: () => void;
}

const GymSettingsContext = createContext<GymSettingsValue | null>(null);

export function GymSettingsProvider({ children }: { children: ReactNode }) {
  // Lazy initialiser: reading storage once at mount beats a render with the
  // defaults followed by an effect that swaps them, which flashes the wrong bar
  // weight on the first paint of the set logger.
  const [settings, setSettings] = useState<GymSettings>(() =>
    parseSettings(readStored(GYM_SETTINGS_KEY)),
  );

  const updateSettings = useCallback((patch: Partial<GymSettings>) => {
    setSettings((previous) => {
      const next: GymSettings = { ...previous, ...patch };

      // Half plates are a view of the rack, so flipping the flag has to actually
      // move the plates -- otherwise the flag is decorative.
      if (patch.useHalfPlates !== undefined && patch.inventory === undefined) {
        next.inventory = applyHalfPlates(previous.inventory, patch.useHalfPlates);
      }

      return {
        ...next,
        inventory: applyHalfPlates(next.inventory, next.useHalfPlates),
      };
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_GYM_SETTINGS);
  }, []);

  useEffect(() => {
    writeStored(GYM_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<GymSettingsValue>(() => {
    const barKg =
      settings.barType === "custom" ? settings.customBarKg : BAR_WEIGHTS[settings.barType];

    return {
      ...settings,
      barKg,
      loadableInventory: settings.inventory,
      updateSettings,
      resetSettings,
    };
  }, [settings, updateSettings, resetSettings]);

  return (
    <GymSettingsContext.Provider value={value}>{children}</GymSettingsContext.Provider>
  );
}

/**
 * Reads the gym settings, falling back to the defaults outside a provider.
 *
 * The fallback is deliberate: a component like `WeightStepper` has to render
 * correctly inside a test, in the dev catalog and in onboarding, none of which
 * wrap the tree in the provider. Anything that *must* know the answer should read
 * `barType` from props instead of relying on this.
 */
export function useGymSettings(): GymSettingsValue {
  const context = useContext(GymSettingsContext);
  if (context) return context;

  return {
    ...DEFAULT_GYM_SETTINGS,
    barKg: BAR_WEIGHTS[DEFAULT_GYM_SETTINGS.barType],
    loadableInventory: DEFAULT_GYM_SETTINGS.inventory,
    updateSettings: () => {},
    resetSettings: () => {},
  };
}
