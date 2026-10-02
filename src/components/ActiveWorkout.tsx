import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Dumbbell,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { NotionJournal } from "./NotionJournal";
import { GymSettingsTrigger } from "./workout/GymSettingsTrigger";
import { RestTimer } from "./RestTimer";
import { SetLoggerRow } from "./SetLoggerRow";
import type { SetEntry } from "../lib/workout/types";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { ExerciseCarousel, type CarouselItem } from "./ExerciseCarousel";
import { ExercisePanel } from "./ExercisePanel";
import { TutorialModal } from "./TutorialModal";
import {
  EMPTY_PERFORMANCE,
  usePreviousPerformance,
} from "../hooks/usePreviousPerformance";
import { useOfflineSync } from "../hooks/useOfflineSync";
import {
  loadRecoverableDraft,
  newSessionId,
  saveDraft,
  deleteDraft,
  type DraftExercise,
  type FinalizePayload,
  type SessionDraft,
} from "../lib/offlineStore";
import { queueAndSync } from "../lib/sessionSync";
import { useActiveSession } from "../context/ActiveSessionContext";
import { useGymSettings } from "../context/GymSettingsContext";
import { SET_LOGGER_LABELS, UNDO_LABELS } from "../lib/i18n";
import { toWarmupColumn } from "../lib/workout/setKind";
import { kgToLb } from "../lib/profile";
import {
  formatRepRange,
  suggestNextTarget,
  type OverloadTarget,
} from "../lib/overload";
import {
  ACCENT,
  DANGER,
  GLASS,
  MOTION,
  RADIUS,
  SOLID,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise } from "../hooks/useGymData";

const DEFAULT_REST = 90;
/** Debounce for persisting the draft, so typing in the journal is not chatty. */
const PERSIST_DEBOUNCE_MS = 400;
/** How long a deleted set can be brought back. Long enough to notice, short
 *  enough that a mis-tap does not leave a ghost row waiting hours later. */
export const UNDO_WINDOW_MS = 5000;

interface ActiveWorkoutProps {
  userId: string;
  routineId: string | null;
  routineTitle: string;
  planned: PlannedExercise[];
  onFinished: () => void;
}

export function ActiveWorkout({
  userId,
  routineId,
  routineTitle,
  planned,
  onFinished,
}: ActiveWorkoutProps) {
  // Client-generated so the session exists offline and the queued write uses
  // the same id. Never re-generated: it is the identity of this session.
  const [logId] = useState(() => newSessionId());
  // Read from the context rather than captured here, so the elapsed time the
  // bottom-nav pill shows and the `started_at` written to the log are the same
  // instant. Captured locally it would restart from zero every time this
  // component remounts, and every remount is a session the user believes is one.
  const { session, end } = useActiveSession();
  const startedAt = session?.startedAt ?? new Date().toISOString();

  const [items, setItems] = useState<DraftExercise[]>(() =>
    planned.map((p) => ({
      key: p.exercise.id,
      exercise: p.exercise,
      restSeconds: p.rest_seconds,
      sets: buildSets(p.target_sets),
    })),
  );
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState<{ id: number; seconds: number } | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [browsingFor, setBrowsingFor] = useState<string | null>(null);
  const [tutorial, setTutorial] = useState<Exercise | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<SessionDraft | null>(null);
  // The single recoverable deletion, or null. See `removeSet`.
  const [pendingRemoval, setPendingRemoval] = useState<{
    itemKey: string;
    index: number;
    entry: SetEntry;
  } | null>(null);
  // Needed by the gym rack for the "last time" chip, so the weight shown there
  // is in the same unit the stepper is offering.
  const gym = useGymSettings();

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const sync = useOfflineSync();

  const selected = useMemo(
    () => items.find((i) => i.key === selectedKey) ?? items[0] ?? null,
    [items, selectedKey],
  );

  // ---- session recovery --------------------------------------------------
  // A session survives a reload, a crash or the tab being closed: any
  // unfinished draft for this user is offered back rather than lost.
  useEffect(() => {
    let alive = true;
    void loadRecoverableDraft(userId).then((draft) => {
      if (!alive || !draft) return;
      setRecovered(draft);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  function restoreRecovered() {
    if (!recovered) return;
    setItems(recovered.items);
    setNotes(recovered.notes);
    setRecovered(null);
    setNotice("Sesión recuperada. Continue donde lo dejaste.");
  }

  function discardRecovered() {
    if (!recovered) return;
    void deleteDraft(recovered.logId);
    setRecovered(null);
  }

  // ---- persist locally ---------------------------------------------------
  // Every mutation lands in IndexedDB, so nothing depends on the network.
  const persist = useCallback(
    (nextItems: DraftExercise[], nextNotes: string, finalized = false) => {
      void saveDraft({
        logId,
        userId,
        routineId,
        routineTitle,
        startedAt,
        items: nextItems,
        notes: nextNotes,
        finalized,
        updatedAt: Date.now(),
      });
    },
    [logId, userId, routineId, routineTitle, startedAt],
  );

  const itemsRef = useRef(items);
  const notesRef = useRef(notes);
  itemsRef.current = items;
  notesRef.current = notes;

  // Debounced autosave; the final write is flushed synchronously on finish.
  useEffect(() => {
    if (recovered) return;
    const timer = window.setTimeout(
      () => persist(items, notes),
      PERSIST_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [items, notes, persist, recovered]);

  // ---- progressive overload ---------------------------------------------
  const exerciseIds = useMemo(() => items.map((i) => i.exercise.id), [items]);
  const { performance } = usePreviousPerformance(userId, exerciseIds);

  const overload = useMemo(() => {
    const map: Record<string, OverloadTarget> = {};
    for (const item of items) {
      // The exercise descriptor is what lets the engine pick a per-muscle-group
      // increment (2.5 kg lower vs 1 kg isolation) and rep range.
      map[item.key] = suggestNextTarget(
        performance[item.exercise.id] ?? EMPTY_PERFORMANCE,
        { exercise: item.exercise },
      );
    }
    return map;
  }, [items, performance]);

  const done = useMemo(
    () => items.reduce((n, i) => n + i.sets.filter((s) => s.completed).length, 0),
    [items],
  );
  const total = useMemo(() => items.reduce((n, i) => n + i.sets.length, 0), [items]);

  function startRest(seconds: number) {
    setRest({ id: Date.now(), seconds: Math.max(seconds, 15) });
  }

  const closeRest = useCallback(() => setRest(null), []);

  /**
   * Closes the undo window on its own.
   *
   * A timer rather than a countdown render: the window is short and a per-second
   * re-render of the whole logger to animate a strip in the corner is a price
   * nobody pays. The strip itself is a CSS animation, so it still drains.
   */
  useEffect(() => {
    if (!pendingRemoval) return;
    const timer = window.setTimeout(() => setPendingRemoval(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [pendingRemoval]);

  /** kg in the unit this user reads, so the chip matches the stepper. */
  const displayKg = useCallback(
    (kg: number): string => {
      const shown = gym.weightUnit === "lb" ? kgToLb(kg) : Math.round(kg * 10) / 10;
      return Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
    },
    [gym.weightUnit],
  );

  function patchEntry(
    itemKey: string,
    setIndex: number,
    patch: (entry: SetEntry) => SetEntry,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.map((s, i) => (i === setIndex ? patch(s) : s)) },
      ),
    );
  }

  function updateSet(itemKey: string, setIndex: number, entry: SetEntry) {
    patchEntry(itemKey, setIndex, () => entry);
    if (!entry.completed) return;
    const restSeconds = items.find((i) => i.key === itemKey)?.restSeconds ?? DEFAULT_REST;
    startRest(restSeconds);
  }

  function addSet(itemKey: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: [...item.sets, emptySet(item.sets.length)] },
      ),
    );
  }

  /**
   * Deletes a set but keeps it recoverable.
   *
   * The row is removed immediately -- a lifter who taps "eliminar" wants the row
   * gone *now*, not after a confirmation -- and the undo banner is the safety
   * net. `pending` holds exactly one entry, so a second deletion supersedes the
   * first rather than queueing behind it; the alternative is a stack of banners
   * competing for the same corner of a phone screen mid-set.
   */
  function removeSet(itemKey: string, setIndex: number) {
    const target = itemsRef.current.find((i) => i.key === itemKey)?.sets[setIndex];
    if (!target) return;

    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.filter((_, i) => i !== setIndex) },
      ),
    );
    setPendingRemoval({ itemKey, index: setIndex, entry: target });
  }

  function undoRemoveSet() {
    const pending = pendingRemoval;
    if (!pending) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== pending.itemKey) return item;
        // Clamped because the set list may have shrunk while the banner was up.
        const at = Math.min(pending.index, item.sets.length);
        const sets = [...item.sets];
        sets.splice(at, 0, pending.entry);
        return { ...item, sets };
      }),
    );
    setPendingRemoval(null);
  }

  /**
   * Copies weight, reps, RPE and kind into a new row directly below.
   *
   * Completion is deliberately *not* copied. The point of duplicating is to have
   * another set to do, and a copy that arrives already ticked off is a set the
   * lifter silently skips -- worse than not having the shortcut at all.
   */
  function duplicateSet(itemKey: string, setIndex: number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== itemKey) return item;
        const source = item.sets[setIndex];
        if (!source) return item;
        const sets = [...item.sets];
        sets.splice(setIndex + 1, 0, {
          ...source,
          completed: false,
          set_number: source.set_number + 1,
        });
        return { ...item, sets };
      }),
    );
  }

  function addExercise(exercise: Exercise) {
    setItems((prev) =>
      prev.some((i) => i.key === exercise.id)
        ? prev
        : [
            ...prev,
            {
              key: exercise.id,
              exercise,
              restSeconds: DEFAULT_REST,
              sets: buildSets(3),
            },
          ],
    );
    setSelectedKey(exercise.id);
  }

  /**
   * Swaps the exercise in place while keeping the set rows, so the lifter does
   * not lose what they already logged against the substitute.
   */
  function replaceExercise(itemKey: string, exercise: Exercise) {
    setItems((prev) => {
      if (prev.some((i) => i.key === exercise.id && i.key !== itemKey)) return prev;
      return prev.map((item) =>
        item.key === itemKey ? { ...item, key: exercise.id, exercise } : item,
      );
    });
    setSelectedKey(exercise.id);
  }

  function removeExercise(itemKey: string) {
    setItems((prev) => prev.filter((i) => i.key !== itemKey));
    setSelectedKey((current) => (current === itemKey ? null : current));
  }

  /** Scrolls the chosen exercise into view and opens its panel. */
  function focusExercise(key: string) {
    setSelectedKey(key);
    setPanelOpen(true);
    const node = sectionRefs.current[key];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---- finish (never blocks on the network) ------------------------------
  async function finish() {
    const currentItems = itemsRef.current;
    const currentNotes = notesRef.current;

    const payload: FinalizePayload = {
      logId,
      userId,
      routineId,
      startedAt,
      completedAt: new Date().toISOString(),
      notes: currentNotes.trim() === "" ? null : currentNotes,
      sets: currentItems.flatMap((item) =>
        item.sets
          .map((set, index) => ({ set, index }))
          .filter(({ set }) => set.completed)
          .map(({ set, index }) => ({
            exercise_id: item.exercise.id,
            set_number: index + 1,
            weight: toNumber(set.weight),
            reps: toNumber(set.reps),
            rpe: toNumber(set.rpe),
            // The richer `kind` stops here: the column has been a boolean since
            // before drop and failure sets existed.
            is_warmup: toWarmupColumn(set.kind),
          })),
      ),
    };

    // 1. Local write first, always. This is the durable record.
    await saveDraft({
      logId,
      userId,
      routineId,
      routineTitle,
      startedAt,
      items: currentItems,
      notes: currentNotes,
      finalized: true,
      updatedAt: Date.now(),
    });

    // 2. Queue for the server, then opportunistically drain.
    //    Failure here is not the user's problem to solve mid-workout.
    void queueAndSync(payload);

    // Ends the session in the context, which is what dismisses the bottom-nav
    // pill. `onFinished` is still called so a host that owns its own copy of the
    // session (a test, a future embedding) stays in sync too.
    end();
    onFinished();
  }

  const carouselItems: CarouselItem[] = items.map((item) => ({
    key: item.key,
    exercise: item.exercise,
    done: item.sets.filter((s) => s.completed).length,
    total: item.sets.length,
  }));

  const showPanel = panelOpen && selected !== null && !recovered;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-50">{routineTitle}</h2>
          <p className="text-xs text-neutral-500">
            {done} de {total} series completadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge
            status={sync.status}
            pending={sync.pending}
            onClick={() => void sync.syncNow()}
          />
          {/*
            The gear sits in the header rather than beside the stepper because the
            stepper is per-set: the answer it needs is the same for the whole
            session, and a control that repeats on every row invites the user to
            think it is per-exercise.
          */}
          <GymSettingsTrigger className="border-white/10 text-neutral-300 hover:bg-white/5" />
          <button
            type="button"
            onClick={() => {
              setBrowsingFor(null);
              setBrowsing(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" /> Ejercicio
          </button>
          <button
            type="button"
            onClick={() => void finish()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:brightness-110"
          >
            <CheckCircle2 className="h-4 w-4" /> Finalizar
          </button>
        </div>
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
        />
      </div>

      {recovered && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">
          <div>
            <p className="text-sm text-neutral-100">
              Encontramos una sesión sin terminar ({recovered.routineTitle})
            </p>
            <p className="text-[11px] text-neutral-400">
              {recovered.items.reduce(
                (n: number, i: DraftExercise) =>
                  n + i.sets.filter((s) => s.completed).length,
                0,
              )}{" "}
              series guardadas en este dispositivo.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discardRecovered}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-neutral-300 transition hover:bg-white/5"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={restoreRecovered}
              className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-neutral-950 transition hover:brightness-110"
            >
              Recuperar
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-300">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            className="text-neutral-500 transition hover:text-neutral-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {pendingRemoval && (
        <UndoBanner
          setNumber={pendingRemoval.index + 1}
          onUndo={undoRemoveSet}
          onDismiss={() => setPendingRemoval(null)}
        />
      )}

      {sync.error && !sync.online && (
        <p className="text-[11px] text-neutral-500">
          Sin conexión: tu sesión está segura en este dispositivo y se sincronizará
          automáticamente.
        </p>
      )}

      {carouselItems.length > 0 && <ExerciseCarousel items={carouselItems} selectedKey={selected?.key ?? null} onSelect={focusExercise} />}

      {items.length === 0 ? (
        <EmptyState onAdd={() => setBrowsing(true)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="space-y-4">
            {showPanel && selected && (
              <ExercisePanel
                exercise={selected.exercise}
                onOpenTutorial={() => setTutorial(selected.exercise)}
                onOpenNotes={() => {
                  const node = sectionRefs.current[selected.key];
                  node?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setNotice("Registra el RPE y las notas en cada serie de abajo.");
                }}
                onReplace={() => {
                  setBrowsingFor(selected.key);
                  setBrowsing(true);
                }}
                onClose={() => setPanelOpen(false)}
              />
            )}

            {items.map((item) => {
              const previous = performance[item.exercise.id];
              const target = overload[item.key];
              const isSelected = selected?.key === item.key;

              return (
                <section
                  key={item.key}
                  ref={(node) => {
                    sectionRefs.current[item.key] = node;
                  }}
                  onFocusCapture={() => setSelectedKey(item.key)}
                  className={`scroll-mt-24 rounded-2xl border bg-neutral-900/60 p-4 shadow-glass backdrop-blur-md transition ${
                    isSelected
                      ? "border-accent/40 ring-1 ring-accent/20"
                      : "border-white/10"
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => focusExercise(item.key)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <h3 className="truncate text-sm font-semibold text-neutral-50">{item.exercise.name}</h3>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {item.exercise.target} · {item.exercise.equipment} · Descanso{" "}
                        {item.restSeconds}s
                        {target?.repRange && ` · Objetivo ${formatRepRange(target.repRange)}`}
                      </p>
                    </button>
                    {previous?.bestSet?.weight != null && (
                      <span
                        className="shrink-0 text-[11px] font-semibold"
                        style={{ color: STATUS.comeback.text }}
                        aria-label={SET_LOGGER_LABELS.lastSessionAriaLabel(
                          displayKg(previous.bestSet.weight),
                          gym.weightUnit,
                          String(previous.bestSet.reps ?? "—"),
                        )}
                      >
                        {SET_LOGGER_LABELS.lastSession(
                          displayKg(previous.bestSet.weight),
                          gym.weightUnit,
                          String(previous.bestSet.reps ?? "—"),
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExercise(item.key)}
                      className="shrink-0 text-[11px] transition"
                      style={{ color: TEXT.tertiary }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.color = DANGER.text;
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.color = TEXT.tertiary;
                      }}
                      onFocus={(event) => {
                        event.currentTarget.style.color = DANGER.text;
                      }}
                      onBlur={(event) => {
                        event.currentTarget.style.color = TEXT.tertiary;
                      }}
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="space-y-2">
                    {item.sets.map((entry, index) => {
                      const isFirst = index === 0;
                      // The hint belongs on the opening set only, and never on a
                      // set the athlete has already completed.
                      const showSuggestion =
                        isFirst &&
                        !!target &&
                        target.decision !== "first_time" &&
                        !entry.completed;

                      return (
                        <SetLoggerRow
                          key={`${item.key}-${index}`}
                          entry={entry}
                          index={index}
                          onChange={(next) => updateSet(item.key, index, next)}
                          onRemove={() => removeSet(item.key, index)}
                          onDuplicate={() => duplicateSet(item.key, index)}
                          previousKg={
                            isFirst ? (previous?.bestSet?.weight ?? undefined) : undefined
                          }
                          previousReps={
                            isFirst ? (previous?.bestSet?.reps ?? undefined) : undefined
                          }
                          suggestion={showSuggestion && target ? target : null}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSet(item.key)}
                    className="mt-2 w-full rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-neutral-400 transition hover:border-accent/50 hover:text-neutral-200"
                  >
                    + Agregar serie
                  </button>
                </section>
              );
            })}
          </div>

          <div className="lg:sticky lg:top-24">
            <NotionJournal value={notes} onChange={setNotes} />
          </div>
        </div>
      )}

      {browsing && (
        <ExerciseBrowser
          onSelect={(ex) => {
            if (browsingFor) replaceExercise(browsingFor, ex);
            else addExercise(ex);
            setBrowsing(false);
            setBrowsingFor(null);
          }}
          onClose={() => {
            setBrowsing(false);
            setBrowsingFor(null);
          }}
        />
      )}

      {tutorial && <TutorialModal exercise={tutorial} onClose={() => setTutorial(null)} />}

      {rest && (
        <RestTimer key={rest.id} seconds={rest.seconds} onClose={closeRest} onFinished={closeRest} />
      )}
    </div>
  );
}

/**
 * Undo window for a deleted set.
 *
 * The strip is a CSS animation rather than a React countdown on purpose: a
 * per-second re-render of the whole logger, mid-session, to move a 2px line is a
 * price nobody pays. `ActiveWorkout` owns the timer that unmounts this; the bar
 * only has to show how much of the window is left.
 */
function UndoBanner({
  setNumber,
  onUndo,
  onDismiss,
}: {
  setNumber: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: SPACE.md,
        zIndex: Z_INDEX.sticky,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.sm,
        overflow: "hidden",
        padding: "10px 14px",
        borderRadius: RADIUS.control,
        border: `1px solid ${GLASS.borderStrong}`,
        background: SOLID.popover,
        boxShadow: GLASS.shadow,
      }}
    >
      <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>
        {UNDO_LABELS.removed(setNumber)}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <button
          type="button"
          onClick={onUndo}
          aria-label={UNDO_LABELS.undoAriaLabel(setNumber)}
          style={{
            minHeight: MOTION.minTouchTarget,
            padding: "0 14px",
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.border}`,
            background: ACCENT.muted,
            color: ACCENT.text,
            fontSize: TYPE.body.size,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {UNDO_LABELS.undo}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={UNDO_LABELS.dismissAriaLabel}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: MOTION.minTouchTarget,
            minHeight: MOTION.minTouchTarget,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: "transparent",
            color: TEXT.tertiary,
            cursor: "pointer",
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </span>
      <span
        aria-hidden="true"
        className="cronos-undo--drain"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: "2px",
          width: "100%",
          transformOrigin: "left center",
          background: ACCENT.base,
          animation: `cronos-undo-drain ${UNDO_WINDOW_MS}ms linear forwards`,
        }}
      />
    </div>
  );
}

/**
 * Sync state indicator.
 *
 * Offline is deliberately reassuring rather than alarming: the session is
 * already saved locally, so "sin conexión" is a status, not an error.
 */
function SyncBadge({
  status,
  pending,
  onClick,
}: {
  status: ReturnType<typeof useOfflineSync>["status"];
  pending: number;
  onClick: () => void;
}) {
  const map = {
    idle: { text: "Guardado", color: TEXT.tertiary, icon: CheckCircle2 },
    syncing: { text: "Sincronizando…", color: STATUS.comeback.text, icon: CloudUpload },
    offline: { text: "Sin conexión", color: STATUS.warning.text, icon: CloudOff },
    pending: {
      text: `${pending} pendiente${pending === 1 ? "" : "s"}`,
      color: STATUS.warning.text,
      icon: CloudUpload,
    },
    error: { text: "Error al sincronizar", color: DANGER.text, icon: RefreshCw },
  } as const;

  const { text, color, icon: Icon } = map[status];

  return (
    <button
      type="button"
      onClick={onClick}
      title="Toca para reintentar la sincronización"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        minHeight: "28px",
        padding: "0 10px",
        borderRadius: RADIUS.control,
        border: `1px solid ${GLASS.border}`,
        background: "transparent",
        fontSize: TYPE.label.size,
        color,
        cursor: "pointer",
      }}
    >
      <Icon
        size={14}
        aria-hidden="true"
        className={status === "syncing" ? "animate-pulse" : undefined}
      />
      {text}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <Dumbbell className="mx-auto mb-3 h-8 w-8 text-neutral-600" />
      <p className="text-sm text-neutral-400">Esta sesión todavía no tiene ejercicios.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:brightness-110"
      >
        Agregar ejercicio
      </button>
    </div>
  );
}

function buildSets(count: number): SetEntry[] {
  return Array.from({ length: Math.max(count, 1) }, (_, i) => emptySet(i));
}

function emptySet(index: number): SetEntry {
  return {
    set_number: index + 1,
    weight: "",
    reps: "",
    rpe: "",
    kind: "normal",
    completed: false,
  };
}

function toNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}