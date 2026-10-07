import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
import { GymSettingsModal } from "./workout/GymSettingsModal";
import { RestTimer } from "./RestTimer";
import { ExerciseStage } from "./workout/ExerciseStage";
import { ExerciseActions, type ExerciseActionId } from "./workout/ExerciseActions";
import { PreWorkoutSummary } from "./workout/PreWorkoutSummary";
import { SetTable } from "./workout/SetTable";
import { loadRestSeconds } from "../lib/workout/restPreferences";
import type { SetEntry } from "../lib/workout/types";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { ExerciseCarousel, type CarouselItem } from "./ExerciseCarousel";
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
  const { session, end, warmups, resolveWarmup } = useActiveSession();
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
  /**
   * Whether the athlete has walked past the pre-workout summary.
   *
   * New state, and the only one this redesign adds: the summary is a decision, not a
   * header. It is shown until "Empezar" is tapped and never again in this session, so
   * coming back to a session does not put the athlete back in front of a gate they have
   * already passed.
   */
  const [started, setStarted] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
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

  /**
   * The session journal's own node.
   *
   * The old layout put it in a sticky rail, so the "Nota" chip could not name it. Below
   * the exercise it is out of sight until scrolled to, and a chip that scrolls somewhere
   * without saying so is a coin toss -- hence a ref and an explicit notice rather than a
   * silent jump.
   */
  const journalRef = useRef<HTMLDivElement | null>(null);
  /** The rendered exercise, so selecting one can bring it to the top. */
  const stageRef = useRef<HTMLDivElement | null>(null);
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
    // Straight into the logger: the summary is for a session that has not begun, and
    // this one has sets already logged against it.
    setStarted(true);
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
  const { performance, previousNotes } = usePreviousPerformance(userId, exerciseIds);

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

  /**
   * The exercise's caption for the stage header, or null when it is new.
   *
   * The rep range from the overload engine is folded in here rather than shown beside
   * it, because "Objetivo 6-8" and "Última sesión: 95 kg × 5" are the same kind of fact
   * -- both are about what the athlete is about to do -- and two pills saying it would
   * be one pill too many on a line that already carries the set count.
   */
  const lastSessionFor = useCallback(
    (exerciseId: string): string | null => {
      const previous = performance[exerciseId];
      const target = overload[selectedKey ?? ""];
      const range = target?.repRange ? formatRepRange(target.repRange) : null;

      if (previous?.bestSet?.weight == null) return range;

      const sentence = SET_LOGGER_LABELS.lastSession(
        displayKg(previous.bestSet.weight),
        gym.weightUnit,
        String(previous.bestSet.reps ?? "—"),
      );
      return range ? `${sentence} · ${range}` : sentence;
    },
    [performance, overload, selectedKey, displayKg, gym.weightUnit],
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
    // The rest this exercise has earned: the athlete's own
    // override when the fatigue summary asked for a longer
    // one, the routine's default otherwise.
    const restSeconds = loadRestSeconds(
      itemKey,
      items.find((i) => i.key === itemKey)?.restSeconds ?? DEFAULT_REST,
    );
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
   * Applies warm-up ramps asked for from another screen.
   *
   * The exercise hub is a different route, and this component's set array is local state, so
   * the hub cannot reach in here. Rather than lifting `items` into context -- which would
   * mean re-plumbing the autosave effect, the undo window, the recovery path and the sync
   * payload for every set in the app -- the hub *asks*, and this drains the queue through
   * `setItems`.
   *
   * Two decisions worth stating:
   *
   * - **Inserted before the working sets, not after.** A ramp that lands below the first
   *   working set is not a ramp; the athlete would do their top set cold. Prepending is why
   *   the request carries its own order.
   * - **`kind: "warmup"` is set here and not in the hub.** `finish()` reads `kind` to decide
   *   the `is_warmup` column, and a warm-up set that reaches the payload unflagged is
   *   counted as volume and corrupts the 1RM estimate for every later session. There is one
   *   place that knows how a set becomes a row, and this is it.
   */
  useEffect(() => {
    const pending = warmups[0];
    if (!pending) return;

    setItems((prev) => {
      // The hub is opened for one movement and the session may not contain it. A ramp for
      // an exercise nobody is training today is discarded rather than silently creating a
      // new row for it -- adding an exercise to a session behind the athlete's back is a
      // worse surprise than the ramp not arriving.
      const index = prev.findIndex((item) => item.exercise.name === pending.exerciseName);
      if (index === -1) return prev;

      const item = prev[index];
      const warmupEntries: DraftExercise["sets"] = pending.weights.map((weight, position) => ({
        ...emptySet(item.sets.length + position),
        weight: String(weight),
        kind: "warmup",
      }));

      return prev.map((entry, at) =>
        at === index ? { ...entry, sets: [...warmupEntries, ...entry.sets] } : entry,
      );
    });

    resolveWarmup(pending.id);
  }, [warmups, resolveWarmup]);

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

  /**
   * Selects an exercise, and puts its own card at the top of the viewport.
   *
   * There is no panel to open any more and no stack of sections to scroll between: one
   * exercise is rendered, so selecting means "make this the one that is rendered". The
   * scroll is to the stage rather than to a section because the carousel is sticky, and
   * without this the newly selected exercise would change underneath the athlete's eyes
   * while they were still reading the strip.
   */
  function focusExercise(key: string) {
    setSelectedKey(key);
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            // The per-set note travels with the row it belongs to. `?? null`
            // rather than the raw value: an unset note is "no note" in the
            // column, and an explicit null (not an omitted key) is what keeps
            // a re-synced session from resurrecting a note the athlete
            // deleted on another device.
            notes: set.notes ?? null,
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

  // Recovery skips the gate: a restored draft is by definition a session already
  // under way, and putting the athlete back behind "Empezar" would ask them to
  // confirm something that already happened.
  const showSummary = !started && !recovered && items.length > 0;

  /**
   * Moves to the next exercise that still has sets left.
   *
   * Wraps round to the first, so the last exercise's "Avance" says "again" rather
   * than doing nothing -- a verb that stops working on the one row where the
   * athlete most wants it to is how a control teaches distrust.
   */
  function advance() {
    if (items.length === 0) return;
    const index = items.findIndex((item) => item.key === selectedKey);
    const next = items[(index + 1) % items.length];
    if (!next) return;
    focusExercise(next.key);
  }

  const actionHandlers: Partial<Record<ExerciseActionId, () => void>> = {
    avance: advance,
    nota: () => {
      journalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setNotice("Tus notas de la sesión están aquí abajo.");
    },
    cambiar: () => {
      if (!selected) return;
      setBrowsingFor(selected.key);
      setBrowsing(true);
    },
    ajustar: () => setGearOpen(true),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}>
      {/*
        The session chrome sits above the gate as well as below it: sync state and the
        gear are facts about the session, not about the exercise, and an athlete who
        cannot reach them from the summary cannot fix a rack problem before starting.
      */}
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.md,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: TYPE.title2.size,
              lineHeight: TYPE.title2.lineHeight,
              fontWeight: TYPE.title2.weight,
              letterSpacing: TYPE.title2.tracking,
              color: TEXT.primary,
            }}
          >
            {routineTitle}
          </h2>
          <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
            {done} de {total} series completadas
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
          <SyncBadge
            status={sync.status}
            pending={sync.pending}
            onClick={() => void sync.syncNow()}
          />
          <GymSettingsTrigger className="border-white/10 text-neutral-300 hover:bg-white/5" />
          <button
            type="button"
            onClick={() => {
              setBrowsingFor(null);
              setBrowsing(true);
            }}
            style={quietButtonStyle}
          >
            <Plus size={14} aria-hidden="true" /> Ejercicio
          </button>
          <button type="button" onClick={() => void finish()} className="gbtn" style={primaryButtonStyle}>
            <CheckCircle2 size={14} aria-hidden="true" /> Finalizar
          </button>
        </div>
      </header>

      {!showSummary && (
        <div
          style={{
            height: 6,
            overflow: "hidden",
            borderRadius: RADIUS.pill,
            background: GLASS.fill,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: RADIUS.pill,
              background: ACCENT.base,
              transition: `width ${MOTION.normal} ${MOTION.standard}`,
              width: `${total === 0 ? 0 : (done / total) * 100}%`,
            }}
          />
        </div>
      )}

      {/*
        Recovery sits above the gate for the same reason: it is the more urgent of the
        two questions, and an athlete whose session was recovered has work to finish,
        not a plan to approve.
      */}
      {recovered && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
            padding: SPACE.md,
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.border}`,
            background: ACCENT.subtle,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: TYPE.body.size, color: TEXT.primary }}>
              Encontramos una sesión sin terminar ({recovered.routineTitle})
            </p>
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
              {recovered.items.reduce(
                (n: number, i: DraftExercise) =>
                  n + i.sets.filter((s) => s.completed).length,
                0,
              )}{" "}
              series guardadas en este dispositivo.
            </p>
          </div>
          <div style={{ display: "flex", gap: SPACE.sm }}>
            <button type="button" onClick={discardRecovered} style={quietButtonStyle}>
              Descartar
            </button>
            <button type="button" onClick={restoreRecovered} className="gbtn" style={primaryButtonStyle}>
              Recuperar
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
            padding: `${SPACE.sm} ${SPACE.md}`,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: SOLID.popover,
          }}
        >
          <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            style={{ ...quietButtonStyle, minWidth: MOTION.minTouchTarget }}
          >
            <X size={14} aria-hidden="true" />
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
        <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          Sin conexión: tu sesión está segura en este dispositivo y se sincronizará
          automáticamente.
        </p>
      )}

      {gearOpen && <GymSettingsModal onClose={() => setGearOpen(false)} />}

      {showSummary ? (
        <PreWorkoutSummary
          routineTitle={routineTitle}
          planned={planned}
          onStart={() => setStarted(true)}
        />
      ) : items.length === 0 ? (
        <EmptyState onAdd={() => setBrowsing(true)} />
      ) : (
        <>
          {/*
            The strip is sticky and above the exercise, and it is the only navigation.
            Everything else on this screen is about the one exercise in front of the
            athlete.
          */}
          <ExerciseCarousel
            items={carouselItems}
            selectedKey={selected?.key ?? null}
            onSelect={focusExercise}
          />

          {selected && (
            <div ref={stageRef}>
              <ExerciseStage
                exercise={selected.exercise}
                progress={`${selected.sets.filter((s) => s.completed).length} de ${selected.sets.length} series`}
                lastSession={lastSessionFor(selected.exercise.id)}
                onRemove={() => removeExercise(selected.key)}
                actions={<ExerciseActions onSelect={actionHandlers} />}
              >
                <SetTable
                  sets={selected.sets}
                  exerciseName={selected.exercise.name}
                  previousKg={performance[selected.exercise.id]?.bestSet?.weight ?? null}
                  previousReps={performance[selected.exercise.id]?.bestSet?.reps ?? null}
                  allTimeBestKg={performance[selected.exercise.id]?.allTimeBest?.weight ?? null}
                  allTimeBestReps={performance[selected.exercise.id]?.allTimeBest?.reps ?? null}
                  // The last session's notes for this exercise, by set
                  // number, so a set can remind the athlete what they
                  // wrote about it last time without a second query.
                  previousNotes={previousNotes[selected.exercise.id]}
                  formatWeight={displayKg}
                  suggestion={overload[selected.key] ?? null}
                  barType={gym.barType}
                  // The rest this exercise should get -- the athlete's
                  // own override when they asked for a longer one -- so
                  // the fatigue summary's "30 s más" builds on the rest
                  // that is actually running, not the routine's first
                  // draft of it.
                  exerciseId={selected.exercise.id}
                  restSeconds={loadRestSeconds(
                    selected.exercise.id,
                    selected.restSeconds,
                  )}
                  onChange={(index, entry) => updateSet(selected.key, index, entry)}
                  onRemove={(index) => removeSet(selected.key, index)}
                  onDuplicate={(index) => duplicateSet(selected.key, index)}
                  onAdd={() => addSet(selected.key)}
                />
              </ExerciseStage>
            </div>
          )}

          {/*
            The journal moves below the exercise rather than sitting beside it. In the
            old two-column layout it had a dedicated rail to itself; here it would be
            pushing the set table off a phone screen, and it is a between-exercises
            tool rather than a during-the-set one.
          */}
          <div ref={journalRef}>
            <NotionJournal value={notes} onChange={setNotes} />
          </div>
        </>
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
          isAdded={(id) => items.some((i) => i.exercise.id === id)}
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
          animation: `cronos-undo-drain ${UNDO_WINDOW_MS}ms ${MOTION.easeLinear} forwards`,
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

/**
 * The quiet button.
 *
 * Hairline, no fill, tertiary text. Everything in the header that is not "Finalizar" is
 * this, so the one accent-filled control in the header is the only thing the eye is
 * pulled to -- and it is the only irreversible one.
 */
const quietButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: 36,
  padding: "0 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.secondary,
  fontSize: TYPE.label.size,
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * The accent-filled button: "Finalizar" and "Recuperar".
 *
 * The token's resolved value rather than `var(--cronos-accent-base)` -- nothing injects
 * the custom properties into the document, so a `var()` here would arrive with no fill.
 * See the note on `stateRules()` in `design/tokens.ts`.
 */
const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: 36,
  padding: "0 14px",
  borderRadius: RADIUS.control,
  border: `1px solid ${ACCENT.base}`,
  background: ACCENT.base,
  color: TEXT.onAccent,
  fontSize: TYPE.label.size,
  fontWeight: 700,
  cursor: "pointer",
};

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
