import { useState } from "react";
import { ChevronDown, ChevronUp, Play, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@lib/supabase";
import { ExerciseBrowser } from "./ExerciseBrowser";
import type { Exercise } from "@/types/supabase";
import type { RoutineWithExercises } from "../hooks/useGymData";
import { getExerciseName } from "../lib/routines/routineDraftModel";

const DEFAULT_REST = 90;

interface PlanItem {
  exercise: Exercise;
  target_sets: number;
  rest_seconds: number;
}

interface Draft {
  id: string | null;
  title: string;
  description: string;
  items: PlanItem[];
}

const EMPTY_DRAFT: Draft = { id: null, title: "", description: "", items: [] };

interface RoutineBuilderProps {
  userId: string;
  routines: RoutineWithExercises[];
  loading: boolean;
  onChanged: () => void;
  onStart: (routine: RoutineWithExercises) => void;
}

export function RoutineBuilder({
  userId,
  routines,
  loading,
  onChanged,
  onStart,
}: RoutineBuilderProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setDraft(EMPTY_DRAFT);
    setEditing(true);
    setError(null);
  }

  function startEdit(routine: RoutineWithExercises) {
    setDraft({
      id: routine.id,
      title: routine.title,
      description: routine.description ?? "",
      items: routine.exercises.map((e) => ({ ...e })),
    });
    setEditing(true);
    setError(null);
  }

  function patch(changes: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function addExercises(exercises: Exercise[]) {
    setDraft((prev) => {
      const existing = new Set(prev.items.map((i) => i.exercise.id));
      const fresh = exercises.filter((e) => !existing.has(e.id));
      if (fresh.length === 0) return prev;
      return {
        ...prev,
        items: [
          ...prev.items,
          ...fresh.map((exercise) => ({
            exercise,
            target_sets: 3,
            rest_seconds: DEFAULT_REST,
          })),
        ],
      };
    });
  }

  function updateItem(index: number, changes: Partial<PlanItem>) {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    }));
  }

  function removeItem(index: number) {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  async function save() {
    if (!draft.title.trim()) {
      setError("Ponle un nombre a la rutina.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: routineError } = draft.id
        ? await supabase
            .from("routines")
            .update({ title: draft.title.trim(), description: draft.description.trim() || null })
            .eq("id", draft.id)
            .select("id")
            .single()
        : await supabase
            .from("routines")
            .insert({
              user_id: userId,
              title: draft.title.trim(),
              description: draft.description.trim() || null,
            })
            .select("id")
            .single();
      if (routineError) throw routineError;

      const routineId = data?.id ?? draft.id;
      if (!routineId) throw new Error("No se pudo identificar la rutina");

      const { error: clearError } = await supabase
        .from("routine_exercises")
        .delete()
        .eq("routine_id", routineId);
      if (clearError) throw clearError;

      if (draft.items.length > 0) {
        const { error: insertError } = await supabase.from("routine_exercises").insert(
          draft.items.map((item, index) => ({
            routine_id: routineId,
            exercise_id: item.exercise.id,
            target_sets: item.target_sets,
            rest_seconds: item.rest_seconds,
            order_index: index,
          })),
        );
        if (insertError) throw insertError;
      }

      setEditing(false);
      setDraft(EMPTY_DRAFT);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina");
    } finally {
      setSaving(false);
    }
  }

  async function remove(routine: RoutineWithExercises) {
    setError(null);
    setDeletingId(routine.id);
    const { error: linkError } = await supabase
      .from("routine_exercises")
      .delete()
      .eq("routine_id", routine.id);
    if (linkError) {
      setError(linkError.message);
      setDeletingId(null);
      return;
    }
    const { error: routineError } = await supabase
      .from("routines")
      .delete()
      .eq("id", routine.id);
    if (routineError) {
      setError(routineError.message);
      setDeletingId(null);
      return;
    }
    if (draft.id === routine.id) {
      setEditing(false);
      setDraft(EMPTY_DRAFT);
    }
    setDeletingId(null);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Mis rutinas</h2>
          <p className="text-xs text-neutral-500">
            {routines.length} {routines.length === 1 ? "rutina guardada" : "rutinas guardadas"}
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva rutina
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {editing && (
        <RoutineForm
          draft={draft}
          saving={saving}
          onPatch={patch}
          onBrowse={() => setBrowsing(true)}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onCancel={() => {
            setEditing(false);
            setDraft(EMPTY_DRAFT);
          }}
          onSave={save}
        />
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando rutinas…</p>
      ) : routines.length === 0 && !editing ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-neutral-500">
          Todavía no tienes rutinas. Crea la primera para empezar a entrenar.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              busy={deletingId === routine.id}
              onStart={() => onStart(routine)}
              onEdit={() => startEdit(routine)}
              onDelete={() => remove(routine)}
            />
          ))}
        </div>
      )}

      {browsing && (
        <ExerciseBrowser
          onAdd={(selected) => {
            addExercises(selected);
            setBrowsing(false);
          }}
          onClose={() => setBrowsing(false)}
          isAdded={(id) => draft.items.some((i) => i.exercise.id === id)}
        />
      )}
    </div>
  );
}

function RoutineForm({
  draft,
  saving,
  onPatch,
  onBrowse,
  onRemoveItem,
  onUpdateItem,
  onCancel,
  onSave,
}: {
  draft: Draft;
  saving: boolean;
  onPatch: (changes: Partial<Draft>) => void;
  onBrowse: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, changes: Partial<PlanItem>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-accent/30 bg-neutral-900/60 p-5 shadow-glass">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 text-xs text-neutral-400">Nombre</span>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder="Push Day"
            className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 text-xs text-neutral-400">Descripción</span>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Opcional"
            className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-2">
        {draft.items.length === 0 && (
          <p className="text-xs text-neutral-500">Sin ejercicios todavía.</p>
        )}
        {draft.items.map((item, index) => (
          <div
            key={item.exercise.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{getExerciseName(item.exercise)}</span>
            <Stepper
              label="Series"
              value={item.target_sets}
              onChange={(v) => onUpdateItem(index, { target_sets: v })}
            />
            <Stepper
              label="Descanso"
              value={item.rest_seconds}
              step={15}
              suffix="s"
              onChange={(v) => onUpdateItem(index, { rest_seconds: v })}
            />
            <button
              type="button"
              onClick={() => onRemoveItem(index)}
              className="text-[11px] text-neutral-600 transition hover:text-red-400"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={onBrowse}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/5"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar ejercicio
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-xs text-neutral-400 transition hover:text-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:brightness-110 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Guardando…" : "Guardar rutina"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step = 1,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-neutral-950/60 px-1.5 py-1">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(step, value - step))}
        className="px-1 text-neutral-400 transition hover:text-neutral-100"
      >
        −
      </button>
      <span className="min-w-8 text-center text-xs tabular-nums">
        {value}
        {suffix}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="px-1 text-neutral-400 transition hover:text-neutral-100"
      >
        +
      </button>
    </div>
  );
}

function RoutineCard({
  routine,
  busy,
  onStart,
  onEdit,
  onDelete,
}: {
  routine: RoutineWithExercises;
  busy: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 shadow-glass backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{routine.title}</h3>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {routine.description ?? `${routine.exercises.length} ejercicios`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Ver ejercicios"
          className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-100"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <ul className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-neutral-400">
          {routine.exercises.length === 0 && <li>Sin ejercicios</li>}
          {routine.exercises.map((item) => (
            <li key={item.exercise.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{getExerciseName(item.exercise)}</span>
              <span className="shrink-0 tabular-nums text-neutral-500">
                {item.target_sets}×{item.rest_seconds}s
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:brightness-110"
        >
          <Play className="h-3.5 w-3.5" /> Empezar
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/5"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label="Eliminar rutina"
          className="rounded-lg border border-white/10 p-2 text-neutral-500 transition hover:text-red-400 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}