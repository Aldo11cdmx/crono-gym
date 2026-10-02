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
import { RestTimer } from "./RestTimer";
import { SetLoggerRow, type SetEntry } from "./SetLoggerRow";
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
import {
  formatPrevious,
  formatRepRange,
  suggestNextTarget,
  type OverloadTarget,
} from "../lib/overload";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise } from "../hooks/useGymData";

const DEFAULT_REST = 90;
/** Debounce for persisting the draft, so typing in the journal is not chatty. */
const PERSIST_DEBOUNCE_MS = 400;

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
  const [startedAt] = useState(() => new Date().toISOString());

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

  function applySuggestion(itemKey: string, setIndex: number, target: OverloadTarget) {
    patchEntry(itemKey, setIndex, (entry) => ({
      ...entry,
      weight: target.weight !== null ? String(target.weight) : entry.weight,
      reps: String(target.reps),
    }));
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

  function removeSet(itemKey: string, setIndex: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.filter((_, i) => i !== setIndex) },
      ),
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
            is_warmup: set.is_warmup,
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
                    <button
                      type="button"
                      onClick={() => removeExercise(item.key)}
                      className="shrink-0 text-[11px] text-neutral-600 transition hover:text-red-400"
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
                          previousLabel={
                            isFirst && previous?.bestSet
                              ? formatPrevious(previous.bestSet)
                              : undefined
                          }
                          suggestion={showSuggestion && target ? target : null}
                          onApplySuggestion={
                            showSuggestion && target
                              ? () => applySuggestion(item.key, index, target)
                              : undefined
                          }
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
    idle: { text: "Guardado", className: "text-neutral-500", icon: CheckCircle2 },
    syncing: { text: "Sincronizando…", className: "text-sky-300", icon: CloudUpload },
    offline: { text: "Sin conexión", className: "text-amber-400", icon: CloudOff },
    pending: { text: `${pending} pendiente${pending === 1 ? "" : "s"}`, className: "text-amber-300", icon: CloudUpload },
    error: { text: "Error al sincronizar", className: "text-red-400", icon: RefreshCw },
  } as const;

  const { text, className, icon: Icon } = map[status];

  return (
    <button
      type="button"
      onClick={onClick}
      title="Toca para reintentar la sincronización"
      className={`flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[11px] transition hover:bg-white/5 ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === "syncing" ? "animate-pulse" : ""}`} />
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
    is_warmup: false,
    completed: false,
  };
}

function toNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}