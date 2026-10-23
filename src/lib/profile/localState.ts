/**
 * localState.ts — the persistence seam for device-local state.
 *
 * One row in IndexedDB (`localState`, keyed by `LOCAL_STATE_KEY`) carries
 * everything this device knows about its owner that is *not* on the server:
 * the local role, the four feature flags, the athlete context fields, and the
 * AI-consent switch.
 *
 * This file is the *only* module that reads or writes that row. The reason is
 * the same one `idb.ts` exists for: two writers with two shapes is how a row
 * ends up half-migrated and half-corrupt, and the failure is silent, because
 * every reader normalises what it finds. One seam, one shape, one normaliser.
 *
 * Every operation resolves `null` on failure rather than throwing. A missing
 * database is the same as "nothing stored", and nothing in this app is
 * allowed to make a workout fail because a flag could not be saved.
 */

import { LOCAL_STATE_KEY } from "../localSession";
import { LOCAL_STATE_STORE, tx } from "../idb";
import { normalizeFeatureFlags } from "./featureFlags";
import type { FeatureFlags } from "./featureFlags";

export type Role = "athlete" | "developer" | "coach";

/** The shape of the one row this module reads and writes. */
export interface LocalStateRow {
  key: string;
  role: Role | null;
  flags: FeatureFlags;
  context: {
    daysPerWeek: number | null;
    injuries: string;
  };
  consent: {
    shareAiContext: boolean;
  };
  /** Bumped by every write so the preamble cache can invalidate. */
  contextRevision: number;
}

/**
 * Reads the row, or `null` when there is no database and no row.
 *
 * Callers are expected to normalise what they find: a row written by an
 * older version of this file may be missing a key, and the flags normaliser
 * in `featureFlags.ts` is the one place that decision lives.
 */
export async function loadLocalState(): Promise<LocalStateRow | null> {
  const row = await tx<LocalStateRow>(LOCAL_STATE_STORE, "readonly", (store) =>
    store.get(LOCAL_STATE_KEY),
  );
  return row ?? null;
}

/**
 * Writes the row, merging the patch into whatever is already there.
 *
 * A brand-new device gets a row shaped like {@link DEFAULT_LOCAL_STATE} on the
 * first write; after that only the fields in the patch change. `contextRevision`
 * is always bumped, because a write that does not move it is a write the
 * preamble cache cannot detect.
 */
export async function saveLocalState(
  patch: Partial<Omit<LocalStateRow, "key">>,
): Promise<LocalStateRow | null> {
  const existing = await loadLocalState();
  const base: LocalStateRow = existing ?? DEFAULT_LOCAL_STATE;
  const next: LocalStateRow = {
    ...base,
    ...patch,
    key: LOCAL_STATE_KEY,
    contextRevision: (base.contextRevision ?? 0) + 1,
  };
  await tx(LOCAL_STATE_STORE, "readwrite", (store) => store.put(next));
  return next;
}

/**
 * Deletes the row entirely.
 *
 * Used by the "reset local profile" action. After this the next read is
 * `null`, which the reader treats as "decide from the environment" — the
 * same as a brand-new device.
 */
export async function clearLocalState(): Promise<void> {
  await tx(LOCAL_STATE_STORE, "readwrite", (store) => store.delete(LOCAL_STATE_KEY));
}

/**
 * What the first write on a brand-new device produces.
 *
 * `role` is `null` rather than `"athlete"` on purpose: the reader in
 * `localSession.ts` treats `null` as "decide from the environment", which is
 * what gives a dev build its developer default. Writing `"athlete"` here
 * would pin the row and the dev default would stop applying.
 */
export const DEFAULT_LOCAL_STATE: LocalStateRow = {
  key: LOCAL_STATE_KEY,
  role: null,
  flags: {
    maintenance: false,
    aiEnabled: true,
    showAiPreamble: false,
    verboseMode: false,
  },
  context: { daysPerWeek: null, injuries: "" },
  consent: { shareAiContext: false },
  contextRevision: 0,
};

/** Re-exported so a caller can ask "is this a valid flags shape" without
 *  reaching into the flags module for the normaliser. */
export { normalizeFeatureFlags };