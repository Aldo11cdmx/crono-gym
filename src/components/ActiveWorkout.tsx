import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Dumbbell, Plus } from "lucide-react";
import { supabase } from "@lib/supabase";
import { NotionJournal } from "./NotionJournal";
import { RestTimer } from "./RestTimer";
import { SetLoggerRow, type SetEntry } from "./SetLoggerRow";
import { ExerciseBrowser } from "./ExerciseBrowser";
import type { Exercise } from "@/types/supabase";
import type { PlannedExercise } from "../hooks/useGymData";

const DEFAULT_REST = 90;

interface ActiveExercise {
  key: string;
  exercise: Exercise;
  restSeconds: number;
  sets: SetEntry[];
}

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
  const [logId, setLogId] = useState<string | null>(null);
  const [items, setItems] = useState<ActiveExercise[]>(() =>
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("workout_logs")
      .insert({
        user_id: userId,
        routine_id: routineId,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single()
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError(err.message);
        else setLogId(data?.id ?? null);
      });
    return () => {
      alive = false;
    };
  }, [userId, routineId]);

  const done = useMemo(
    () => items.reduce((n, i) => n + i.sets.filter((s) => s.completed).length, 0),
    [items],
  );
  const total = useMemo(() => items.reduce((n, i) => n + i.sets.length, 0), [items]);

  function startRest(seconds: number) {
    setRest({ id: Date.now(), seconds: Math.max(seconds, 15) });
  }

  const closeRest = useCallback(() => setRest(null), []);
  const finishRest = useCallback(() => setRest(null), []);

  function updateSet(itemKey: string, setIndex: number, entry: SetEntry) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.map((s, i) => (i === setIndex ? entry : s)) },
      ),
    );
    const restSeconds = items.find((i) => i.key === itemKey)?.restSeconds ?? DEFAULT_REST;
    if (entry.completed) startRest(restSeconds);
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
        : [...prev, { key: exercise.id, exercise, restSeconds: DEFAULT_REST, sets: buildSets(3) }],
    );
  }

  function removeExercise(itemKey: string) {
    setItems((prev) => prev.filter((i) => i.key !== itemKey));
  }

  async function finish() {
    if (!logId) {
      setError(error ?? "No se pudo iniciar el registro del entrenamiento.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const rows = items.flatMap((item) =>
        item.sets
          .map((set, index) => ({ set, index }))
          .filter(({ set }) => set.completed)
          .map(({ set, index }) => ({
            log_id: logId,
            exercise_id: item.exercise.id,
            set_number: index + 1,
            weight: toNumber(set.weight),
            reps: toNumber(set.reps),
            rpe: toNumber(set.rpe),
            is_warmup: set.is_warmup,
          })),
      );
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from("completed_sets").insert(rows);
        if (insertError) throw insertError;
      }
      const { error: logError } = await supabase
        .from("workout_logs")
        .update({ completed_at: new Date().toISOString(), journal_notes: notes || null })
        .eq("id", logId);
      if (logError) throw logError;
      onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el entrenamiento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{routineTitle}</h2>
          <p className="text-xs text-neutral-500">
            {done} de {total} series completadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBrowsing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" /> Ejercicio
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={saving || !logId}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:brightness-110 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? "Guardando…" : "Finalizar"}
          </button>
        </div>
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState onAdd={() => setBrowsing(true)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="space-y-4">
            {items.map((item) => (
              <section
                key={item.key}
                className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 shadow-glass backdrop-blur-md"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{item.exercise.name}</h3>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {item.exercise.target} · {item.exercise.equipment} · Descanso{" "}
                      {item.restSeconds}s
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(item.key)}
                    className="text-[11px] text-neutral-600 transition hover:text-red-400"
                  >
                    Quitar
                  </button>
                </div>

                <div className="space-y-2">
                  {item.sets.map((entry, index) => (
                    <SetLoggerRow
                      key={`${item.key}-${index}`}
                      entry={entry}
                      index={index}
                      onChange={(next) => updateSet(item.key, index, next)}
                      onRemove={() => removeSet(item.key, index)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addSet(item.key)}
                  className="mt-2 w-full rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-neutral-400 transition hover:border-accent/50 hover:text-neutral-200"
                >
                  + Agregar serie
                </button>
              </section>
            ))}
          </div>

          <div className="lg:sticky lg:top-24">
            <NotionJournal value={notes} onChange={setNotes} />
          </div>
        </div>
      )}

      {browsing && (
        <ExerciseBrowser
          onSelect={(ex) => {
            addExercise(ex);
            setBrowsing(false);
          }}
          onClose={() => setBrowsing(false)}
        />
      )}

      {rest && (
        <RestTimer
          key={rest.id}
          seconds={rest.seconds}
          onClose={closeRest}
          onFinished={finishRest}
        />
      )}
    </div>
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