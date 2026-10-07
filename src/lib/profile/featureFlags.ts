/**
 * featureFlags.ts — the four switches the God Mode panel owns.
 *
 * These flags are *not* the thing that decides what a user may do. They are
 * feature toggles, held locally, and the enforcement that actually matters
 * lives elsewhere: `maintenance` gates a banner in `AppShell`, `aiEnabled`
 * short-circuits `askCoach`, `verboseMode` turns on coach logging. This file
 * only owns the shape, the defaults and the normalisation of whatever a
 * corrupted row hands back.
 *
 * The defaults are chosen so a brand-new local state is indistinguishable
 * from a state that was never written at all: everything off except the one
 * flag that is already true today, which is `aiEnabled`. Shipping a toggle
 * that starts in the "off" position would turn the coach off for every user
 * on day one, and the flag exists to *enable* a capability, not to gate it.
 */

/** The four flags, in the order the God Mode panel renders them. */
export type FeatureFlags = {
  maintenance: boolean;
  aiEnabled: boolean;
  showAiPreamble: boolean;
  verboseMode: boolean;
};

/** What a row with no flags stored (or a brand-new device) looks like. */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  maintenance: false,
  aiEnabled: true,
  showAiPreamble: false,
  verboseMode: false,
};

/** Keys this shape knows about. Anything else is dropped, never invented. */
const FLAG_KEYS: readonly (keyof FeatureFlags)[] = [
  "maintenance",
  "aiEnabled",
  "showAiPreamble",
  "verboseMode",
];

/**
 * Coerces whatever came out of Dexie into a valid `FeatureFlags`.
 *
 * A corrupted row — a string where a boolean was expected, a missing key, a
 * `null` — resolves to the default for that key rather than to `undefined`.
 * Callers must not have to branch on "is this flag defined" every time they
 * read it.
 */
export function normalizeFeatureFlags(raw: unknown): FeatureFlags {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FEATURE_FLAGS };
  const source = raw as Record<string, unknown>;
  const out: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
  for (const key of FLAG_KEYS) {
    const value = source[key];
    out[key] = typeof value === "boolean" ? value : DEFAULT_FEATURE_FLAGS[key];
  }
  return out;
}