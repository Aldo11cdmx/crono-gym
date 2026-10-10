/**
 * useCoach.ts — the Coach module's read and write surface.
 *
 * Three hooks rather than one, because the three things have different lifetimes:
 * the training context is recomputed whenever any of four sources change, while
 * notes and recommendations are loaded once and then edited locally. Bundling them
 * would mean every keystroke in a note re-derived the whole context.
 *
 * Nothing here fetches training data itself. The four sources already exist and
 * already know how to load themselves -- re-implementing their queries here would
 * be a second answer to "how do we get a user's sessions", and the two would drift.
 *
 * A cost worth stating plainly: `useMuscleRanks` reads up to two years of sets, and
 * it does not share a cache with the ranks view. Opening `/coach` and then `/rangos`
 * therefore fetches that history twice. Fixing it means lifting a cache into
 * `useMuscleRanks`, which is a change to a module this step is only reading -- so it
 * is left as a known cost rather than half-solved here.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildCoachContext } from "@/lib/coach/buildCoachContext";
import type {
  CoachContext,
  CoachContextSource,
  CoachNote,
  CoachNoteDraft,
  Recommendation,
} from "@/lib/coach/types";
import { useBodyMetrics, useProfile } from "./useProfile";
import { useProgress } from "./useGymData";
import { useMuscleRanks } from "./useMuscleRanks";
import { useAthleteContext } from "./useAthleteContext";
import { hasValidConsent } from "@/lib/profile/consent";
import type { LocalStateRow } from "@/lib/profile/localState";

// ---------------------------------------------------------------- ids

let noteCounter = 0;

/**
 * Note id, generated locally.
 *
 * Prefers `crypto.randomUUID` but falls back to a counter, because it needs a
 * secure context and the app is also served over plain http on a LAN. The id is
 * replaced by the database's own on the Step 2 migration, so nothing outside this
 * module should depend on its shape.
 */
function newNoteId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  noteCounter += 1;
  return `note-${Date.now().toString(36)}-${noteCounter}`;
}

// ---------------------------------------------------------- in-memory source

/** Per-user stores, module-scoped so notes survive unmounting the hub. */
const memoryStore = new Map<string, { notes: CoachNote[]; recommendations: Recommendation[] }>();

/**
 * The Step 1 {@link CoachContextSource}: in memory, for this browser session only.
 *
 * Deliberately not a fake database. It has the same three-method shape the real
 * store will implement, so swapping it in Step 2 touches one import and no
 * component -- and a user who refreshes losing their notes is the correct behaviour
 * for a store that never claimed to persist anything. Writing it as a fake
 * localStorage shim now would mean shipping the illusion of durability and taking
 * it back later.
 */
export function createMemoryCoachSource(): CoachContextSource {
  const read = (userId: string) => {
    const existing = memoryStore.get(userId);
    if (!existing) {
      const fresh = { notes: [], recommendations: [] };
      memoryStore.set(userId, fresh);
      return fresh;
    }
    return existing;
  };

  return {
    async load(userId) {
      const { notes, recommendations } = read(userId);
      // Cloned so a caller mutating its copy cannot edit the store's array in place
      // and make the next `load` return something the reducer never saw.
      return { notes: [...notes], recommendations: [...recommendations] };
    },
    async save(userId, patch) {
      const current = read(userId);
      memoryStore.set(userId, {
        notes: patch.notes ? [...patch.notes] : current.notes,
        recommendations: patch.recommendations
          ? [...patch.recommendations]
          : current.recommendations,
      });
    },
  };
}

/** The default seam, so callers do not have to thread one through. */
let defaultSource: CoachContextSource = createMemoryCoachSource();

/** Replaces the seam. Step 2 hands the Supabase-backed store to this. */
export function setCoachSource(source: CoachContextSource): void {
  defaultSource = source;
}

// --------------------------------------------------------- training context

export interface CoachContextState {
  context: CoachContext | null;
  /**
   * True while any source is still loading.
   *
   * Not a per-source flag on purpose: the hub renders one briefing, and painting it
   * from three sources that arrived at different times produces a screen where the
   * bodyweight appears next to a volume figure that predates it. The coach waits for
   * all four.
   */
  loading: boolean;
  /** The first error across the sources, so a failure is not silently averaged out. */
  error: string | null;
}

/**
 * Resolves local-state-derived fields for the coach context, gated on consent.
 *
 * Returns `injuries` and `daysPerWeek` only when the athlete has consented to
 * sharing AI context. When consent is absent or denied, both are undefined so
 * the CoachContext never carries them into a prompt. The wire-level strip in
 * `coachAssistant.ts` is a second layer; this is the first.
 */
export function resolveConsentedLocalContext(
  row: LocalStateRow | null,
  isDev: boolean,
): { injuries?: string; daysPerWeek?: number } {
  if (!row || !hasValidConsent(row.consent, isDev)) {
    return {};
  }
  const result: { injuries?: string; daysPerWeek?: number } = {};
  if (row.context.injuries) {
    result.injuries = row.context.injuries;
  }
  if (
    row.context.daysPerWeek !== null &&
    row.context.daysPerWeek !== undefined &&
    Number.isInteger(row.context.daysPerWeek)
  ) {
    result.daysPerWeek = row.context.daysPerWeek;
  }
  return result;
}

/**
 * The assembled training context, derived from the four existing data hooks.
 *
 * Returns `null` until every source has settled, which is the contract the hub relies
 * on to avoid flashing partial numbers.
 */
export function useCoachContext(userId: string | null): CoachContextState {
  const { profile, energy, loading: profileLoading, error: profileError } = useProfile(userId);
  const {
    latestWeight,
    changeLast30Days,
    weights,
    loading: bodyLoading,
    error: bodyError,
  } = useBodyMetrics(userId);
  const { stats, loading: progressLoading, error: progressError } = useProgress(userId);
  const { map, loading: ranksLoading, error: ranksError } = useMuscleRanks(userId);
  const { row: localRow } = useAthleteContext();

  // Local state is advisory: a failed or slow read must not block the context.
  // Consent-gated extras are resolved separately so an offline box still surfaces
  // a usable briefing.
  const loading = profileLoading || bodyLoading || progressLoading || ranksLoading;

  const error = profileError ?? bodyError ?? progressError ?? ranksError ?? null;

  /*
   * Memoised on the identities of the four sources, not on a deep comparison. The
   * builders they feed are pure and cheap -- a map over ~20 muscles -- and a deep
   * compare of the full context would cost more than rebuilding it.
   */
  const context = useMemo(() => {
    if (loading) return null;

    const localExtras = resolveConsentedLocalContext(localRow, import.meta.env?.DEV ?? false);

    return buildCoachContext({
      profile,
      energy,
      progress: stats,
      ranks: map,
      bodyweight: {
        latestKg: latestWeight,
        changeLast30Days,
        seriesCount: weights.length,
      },
      ...localExtras,
    });
  }, [
    loading,
    profile,
    energy,
    stats,
     map,
     latestWeight,
     changeLast30Days,
     weights.length,
     localRow?.context?.injuries,
     localRow?.context?.daysPerWeek,
     localRow?.consent?.shareAiContext,
   ]);

  return { context, loading, error };
}

// ------------------------------------------------------- notes & suggestions

type Action =
  | { type: "loaded"; notes: CoachNote[]; recommendations: Recommendation[] }
  | { type: "note_added"; note: CoachNote }
  | { type: "note_removed"; id: string }
  | { type: "recommendation_dismissed"; id: string };

function reduce(state: CoachStore, action: Action): CoachStore {
  switch (action.type) {
    case "loaded":
      return { notes: action.notes, recommendations: action.recommendations };
    case "note_added":
      // Newest first, so a just-written note is the one the user sees.
      return { ...state, notes: [action.note, ...state.notes] };
    case "note_removed":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "recommendation_dismissed":
      return {
        ...state,
        recommendations: state.recommendations.filter((r) => r.id !== action.id),
      };
  }
}

interface CoachStore {
  notes: CoachNote[];
  recommendations: Recommendation[];
}

export interface CoachNotesState extends CoachStore {
  /** True only for the first load. */
  loading: boolean;
  saving: boolean;
  error: string | null;
  addNote: (draft: CoachNoteDraft) => Promise<boolean>;
  removeNote: (id: string) => Promise<void>;
  dismissRecommendation: (id: string) => Promise<void>;
}

/**
 * Notes and recommendations, loaded through the persistence seam.
 *
 * State lives in a reducer rather than two `useState` calls so a load and an edit
 * can never interleave into a half-applied store: both go through one function, and
 * the order they are applied in is the order they are decided.
 *
 * The optimistic write is deliberate. A note is the athlete's own words, and making
 * them watch a spinner after every save would be a worse experience than a rare
 * failed write -- and the failure is still surfaced rather than swallowed.
 */
export function useCoachNotes(
  userId: string | null,
  source: CoachContextSource = defaultSource,
): CoachNotesState {
  const [state, dispatch] = useReducer(reduce, { notes: [], recommendations: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Read through a ref so a changed `source` identity does not re-trigger the load
   * effect. Step 2 swaps the source once at module scope; reloading every note
   * because a parent re-rendered with a fresh object literal would drop unsaved text.
   */
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (!userId) {
      dispatch({ type: "loaded", notes: [], recommendations: [] });
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    void sourceRef.current
      .load(userId)
      .then((loaded) => {
        if (!alive) return;
        dispatch({
          type: "loaded",
          notes: loaded.notes,
          recommendations: loaded.recommendations,
        });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const addNote = useCallback(
    async (draft: CoachNoteDraft): Promise<boolean> => {
      if (!userId) return false;
      const body = draft.body.trim();
      // An empty note is not a note. Rejected here rather than stored and filtered
      // on read, so the log never holds a row that renders as nothing.
      if (body === "") return false;

      const note: CoachNote = { ...draft, body, id: newNoteId(), createdAt: new Date().toISOString() };
      const next = { notes: [note, ...state.notes], recommendations: state.recommendations };
      dispatch({ type: "note_added", note });
      setSaving(true);
      setError(null);
      try {
        await sourceRef.current.save(userId, { notes: next.notes });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId, state.notes, state.recommendations],
  );

  const removeNote = useCallback(
    async (id: string) => {
      if (!userId) return;
      const next = state.notes.filter((n) => n.id !== id);
      dispatch({ type: "note_removed", id });
      try {
        await sourceRef.current.save(userId, { notes: next });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [userId, state.notes],
  );

  const dismissRecommendation = useCallback(
    async (id: string) => {
      if (!userId) return;
      const next = state.recommendations.filter((r) => r.id !== id);
      dispatch({ type: "recommendation_dismissed", id });
      try {
        await sourceRef.current.save(userId, { recommendations: next });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [userId, state.recommendations],
  );

  return {
    ...state,
    loading,
    saving,
    error,
    addNote,
    removeNote,
    dismissRecommendation,
  };
}
