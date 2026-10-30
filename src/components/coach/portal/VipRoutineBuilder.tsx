/**
 * VipRoutineBuilder.tsx — the coach writing a routine by hand, into somebody's library.
 *
 * The only screen in the product where one user authors a row that belongs to another user,
 * and the only place a plan arrives without a model in the loop. That removes the whole
 * class of problem the AI path spends its files defending against -- there is no invented
 * exercise id, no truncated sentence, no fence to parse -- and replaces it with one of its
 * own: a coach's prescription is exact, so writing it wrong is worse than not writing it.
 *
 * **The exercise picker searches real catalogue rows and nothing else.** The model path has
 * `substituteUnknownExercises` to repair ids that do not exist, because a language model will
 * confidently invent a uuid. A human typing cannot invent one by accident, so there is no
 * repair step here and no fuzzy matching: `normaliseExerciseName` makes the search
 * accent- and case-insensitive and then the first catalogue row whose name matches wins.
 * Near-misses are not offered, because a set written against the wrong movement is credited
 * by the ranks engine to a muscle the athlete did not train.
 *
 * **The search is filtered in the component rather than refetched.** The catalogue is a
 * reference table with no user dimension -- `useExerciseCatalog` reads all of `exercises` and
 * only uses its argument as an on/off switch -- so narrowing a 1,300-row list is arithmetic
 * in memory. Querying per keystroke would put a network round trip between a coach and the
 * exercise they are looking for.
 *
 * **Nothing is saved until the draft is complete.** `draftProblem` runs before the first
 * insert, and it checks the coach id as well as the contents: `authored_by_coach` is what
 * makes the compensating delete legal, so a save without it would leave a row nobody can
 * clean up if the second insert failed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, RefreshCw, Sparkles } from "lucide-react";

import { ACCENT, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { UnifiedExerciseSelectorSheet } from "@/components/UnifiedExerciseSelectorSheet";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { getCoachId } from "@/lib/coach/useCoachAuth";
import {
  draftProblem,
  type CoachRoutineDay,
  type CoachRoutineDraft,
  type CoachRoutineExercise,
  type DraftProblem,
} from "@/lib/routines/coachRoutineDraft";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import type { Exercise } from "@/types/supabase";
import { supabase } from "@lib/supabase";
import { hapticSuccess } from "@/lib/haptics";

import { saveCoachRoutine } from "@/lib/routines/saveCoachRoutine";
import { saveCoachTemplate } from "@/lib/routines/saveCoachTemplate";
import { ExerciseSubstitutionModal } from "./ExerciseSubstitutionModal";

/** A fresh day, so two days never share an array by accident. */
function emptyDay(): CoachRoutineDay {
  return { label: "", exercises: [] };
}

/**
 * One message per reason a save is refused.
 *
 * A lookup rather than a chain of ternaries: the reasons are a union that will grow, and a
 * nested conditional over it is where a new case silently falls through to the wrong message.
 * `satisfies` makes a missing case a compile error instead.
 */
const PROBLEM_MESSAGE = {
  noCoachId: T.builderNeedsCoach,
  noTitle: T.builderNoTitle,
  noExercises: T.builderNeedsDay,
  unpickedExercise: T.builderNeedsExerciseChoice,
} satisfies Record<DraftProblem, string>;

/** Plan de 4 días: cada día con grupos musculares para buscar en el catálogo. */
const DAY_PLAN: { label: string; bodyParts: string[] }[] = [
  { label: "Día 1 - Empuje", bodyParts: ["chest", "upper arms"] },
  { label: "Día 2 - Tirón", bodyParts: ["back", "upper arms"] },
  { label: "Día 3 - Piernas", bodyParts: ["upper legs", "lower legs"] },
  { label: "Día 4 - Hombros y core", bodyParts: ["shoulders", "waist"] },
];

/** Series/reps/descanso por objetivo. */
const GOAL_PRESETS: Record<
  string,
  { sets: number; repsMin: number; repsMax: number; restSeconds: number }
> = {
  hipertrofia: { sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
  fuerza: { sets: 4, repsMin: 3, repsMax: 6, restSeconds: 180 },
  perder_grasa: { sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60 },
  recomposicion: { sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 },
};

export interface VipRoutineBuilderProps {
  /** The athlete the routine is written for. Null when building a global template. */
  athleteId: string | null;
  /** When true, saves as a global template (`is_template`) instead of an athlete routine. */
  isTemplate?: boolean;
  /** Reports the saved routine's title, so the portal can acknowledge it. */
  onSaved?: (title: string) => void;
}

export function VipRoutineBuilder({ athleteId, isTemplate = false, onSaved }: VipRoutineBuilderProps) {
  /*
   * The catalogue gate is the athlete, not the coach: the hook only reads `exercises`, and
   * passing the athlete keeps it consistent with every other read in this panel. Passing the
   * coach would work today and break the moment the catalog became per-user.
   */
  const { exercises, loading: catalogLoading } = useExerciseCatalog();

  const [title, setTitle] = useState("");
  const [days, setDays] = useState<CoachRoutineDay[]>([emptyDay()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [offlinePending, setOfflinePending] = useState(false);
  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [substitutingExercise, setSubstitutingExercise] = useState<CoachRoutineExercise | null>(null);
  const [substituteDayIndex, setSubstituteDayIndex] = useState<number | null>(null);
  const [substituteExerciseIndex, setSubstituteExerciseIndex] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorDayIndex, setSelectorDayIndex] = useState<number | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [athleteGoal, setAthleteGoal] = useState<string | null>(null);
  const [athletePhase, setAthletePhase] = useState<"deload" | "maintenance" | "overload" | null>(null);

  /** Lee la fase y el objetivo del atleta para personalizar la rutina generada. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadAthleteContext = useCallback(async () => {
    if (!athleteId) return;

    const [phaseRow, requestRow] = await Promise.all([
      supabase
        .from("athlete_phases")
        .select("phase")
        .eq("athlete_id", athleteId)
        .single(),
      supabase
        .from("coach_session_requests")
        .select("athlete_notes, created_at")
        .eq("athlete_id", athleteId)
        .single(),
    ]);

    if (!mounted.current) return;

    if (phaseRow.data?.phase) {
      setAthletePhase(phaseRow.data.phase);
    }

    const notes = requestRow.data?.athlete_notes ?? null;
    const goalMatch = notes?.match(/Objetivo:\s*([^\n]+)/);
    if (goalMatch?.[1]?.trim()) {
      setAthleteGoal(goalMatch[1].trim());
    }
  }, [athleteId]);

  useEffect(() => {
    void loadAthleteContext();
  }, [loadAthleteContext]);

  /** Auto-dismissa el toast de confirmación tras 4 segundos. */
  useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * Persiste el borrador en localStorage cada vez que cambia, para que
   * sobreviva a recargas y a fallos de red. Clave por atleta.
   */
  useEffect(() => {
    if (!athleteId) return;
    try {
      localStorage.setItem(
        `draft_routine_${athleteId}`,
        JSON.stringify({ title, days, updatedAt: Date.now() }),
      );
    } catch {
      // localStorage no disponible o cuota excedida: se ignora, el flujo online sigue funcionando.
    }
  }, [athleteId, title, days]);

  /**
   * Restaura el borrador guardado cuando se monta para un atleta y aún no hay
   * nada escrito. Evita perder lo escrito si el coach cierra la pestaña a mitad.
   */
  useEffect(() => {
    if (!athleteId) return;
    try {
      const raw = localStorage.getItem(`draft_routine_${athleteId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if ((parsed.title ?? "").trim() || (parsed.days ?? []).length > 0) {
        setTitle(parsed.title ?? "");
        setDays(parsed.days ?? [emptyDay()]);
      }
    } catch {
      // Borrador corrupto: se ignora y se empieza limpio.
    }
  }, [athleteId]);

  /**
   * Genera una rutina estructurada con ejercicios del catálogo,
   * ajustada al objetivo y fase del atleta.
   *
   * Nunca inventa ejercicios: cada `exerciseId` viene de una fila real de
   * `exercises` filtrada por `body_part`. El coach puede editar todo antes
   * de guardar.
   */
  const generateAIRoutine = useCallback(() => {
    if (!athleteId || generatingAi || exercises.length === 0) return;

    setGeneratingAi(true);
    setError(null);

    try {
      const preset =
        GOAL_PRESETS[athleteGoal ?? "hipertrofia"] ?? GOAL_PRESETS.hipertrofia;
      let sets = preset.sets;
      if (athletePhase === "deload") sets = Math.max(2, sets - 1);
      if (athletePhase === "overload") sets = preset.sets + 1;

      const newDays: CoachRoutineDay[] = DAY_PLAN.map((plan) => {
        const exercisesForDay: CoachRoutineExercise[] = plan.bodyParts.flatMap(
          (bodyPart) => {
            const match = exercises.find(
              (e) => e.body_part === bodyPart,
            );
            if (!match) return [];
            return [
              {
                exerciseId: match.id,
                exerciseName: match.name,
                sets,
                repsMin: preset.repsMin,
                repsMax: preset.repsMax,
                restSeconds: preset.restSeconds,
              },
            ];
          },
        );
        return { label: plan.label, exercises: exercisesForDay };
      });

      const titleByGoal: Record<string, string> = {
        hipertrofia: "Hipertrofia 4 días",
        fuerza: "Fuerza 4 días",
        perder_grasa: "Pérdida de grasa 4 días",
        recomposicion: "Recomposición 4 días",
      };

      setTitle(titleByGoal[athleteGoal ?? "hipertrofia"] ?? titleByGoal.hipertrofia);
      setDays(newDays);
      setSaved(null);
    } finally {
      setGeneratingAi(false);
    }
  }, [athleteId, athleteGoal, athletePhase, exercises.length, generatingAi]);

  /**
   * The coach's own row id, read once per save rather than held in state.
   *
   * It comes from the shared coach session, so it is already in memory and re-reading it is
   * free -- while state would be a second copy that could disagree with the session the rest
   * of the portal renders from.
   */
  const save = useCallback(async () => {
    if (athleteId === null || saving) return;

    const draft: CoachRoutineDraft = { title, days };
    const coachId = getCoachId();

    const problem = draftProblem(draft, coachId);
    if (problem !== null) {
      setSaved(null);
      setError(PROBLEM_MESSAGE[problem]);
      return;
    }

    // Optimistic: muestra "guardada" inmediatamente; se revierte si falla.
    const savedTitle = draft.title.trim();
    setTitle("");
    setDays([emptyDay()]);
    setSaved(T.builderSaved(savedTitle));
    setSaving(true);
    setError(null);

    const ok = await saveCoachRoutine(athleteId, coachId as string, draft);

    setSaving(false);

    if (!ok) {
      // Rollback: devuelve el borrador para que el coach no pierda lo escrito.
      setTitle(savedTitle);
      setDays(draft.days);
      // Marca la sincronización pendiente: localStorage ya tiene el draft y se
      // reintentará al volver online.
      setOfflinePending(true);
      setSaved(null);
      setError(T.builderSaveError);
      setToast(T.builderOfflineToast);
      return;
    }

    hapticSuccess();
    setSaved(T.builderSaved(savedTitle));
    setToast(T.builderSavedToast);
    onSaved?.(savedTitle);
  }, [athleteId, days, onSaved, saving, title]);

  /**
   * Inyecta un lote de ejercicios seleccionados en el día indicado.
   * Cada ejercicio llega del catálogo con valores por defecto de serie.
   */
  const handleSelectExercises = useCallback(
    (selected: Exercise[], dayIndex: number) => {
      setDays((current) =>
        current.map((d, i) => {
          if (i !== dayIndex) return d;
          return {
            ...d,
            exercises: [
              ...d.exercises,
              ...selected.map((ex) => ({
                exerciseId: ex.id,
                exerciseName: ex.name,
                sets: 4,
                repsMin: 8,
                repsMax: 12,
                restSeconds: 90,
              })),
            ],
          };
        }),
      );
      setSelectorOpen(false);
      setSelectorDayIndex(null);
    },
    [],
  );

  /**
   * Reintenta el guardado pendiente cuando vuelve la conexión. Lee el borrador
   * de localStorage y vuelve a disparar `save()`.
   */
  useEffect(() => {
    const onOnline = () => {
      if (!offlinePending || !athleteId) return;
      try {
        const raw = localStorage.getItem(`draft_routine_${athleteId}`);
        if (!raw) {
          setOfflinePending(false);
          return;
        }
        const parsed = JSON.parse(raw);
        setTitle(parsed.title ?? "");
        setDays(parsed.days ?? [emptyDay()]);
        setOfflinePending(false);
        void save();
      } catch {
        setOfflinePending(false);
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [offlinePending, athleteId, save]);

  /**
   * Reemplaza el ejercicio de una fila por uno del mismo grupo muscular.
   *
   * `dayIndex` y `exerciseIndex` identifican la fila; el catálogo se filtra
   * por `body_part` dentro del modal.
   */
  const openSubstitute = useCallback(
    (dayIndex: number, exerciseIndex: number) => {
      const exercise = days[dayIndex]?.exercises[exerciseIndex];
      if (!exercise || !exercise.exerciseId) return;

      const current = exercises.find((e) => e.id === exercise.exerciseId);
      if (!current) return;

      setSubstitutingExercise(exercise);
      setSubstituteDayIndex(dayIndex);
      setSubstituteExerciseIndex(exerciseIndex);
      setSubstituteOpen(true);
    },
    [days, exercises],
  );

  const doSubstitute = useCallback(
    (replacement: Exercise) => {
      if (substituteDayIndex === null || substituteExerciseIndex === null) return;

      setDays((current) =>
        current.map((day, d) => {
          if (d !== substituteDayIndex) return day;
          return {
            ...day,
            exercises: day.exercises.map((e, i) => {
              if (i !== substituteExerciseIndex) return e;
              return {
                ...e,
                exerciseId: replacement.id,
                exerciseName: replacement.name,
              };
            }),
          };
        }),
      );
      setSubstituteOpen(false);
      setSubstitutingExercise(null);
      setSubstituteDayIndex(null);
      setSubstituteExerciseIndex(null);
    },
    [substituteDayIndex, substituteExerciseIndex],
  );

  if (athleteId === null) {
    return (
      <GlassCard>
        {/* Its own copy: the CRM renders above this in the portal column. See `builderSelectPrompt`. */}
        <p style={bodyStyle}>{T.builderSelectPrompt}</p>
      </GlassCard>
    );
  }

  const saveTemplate = useCallback(async () => {
    if (saving) return;

    const draft: CoachRoutineDraft = { title, days };
    const coachId = getCoachId();

    const problem = draftProblem(draft, coachId);
    if (problem !== null) {
      setSaved(null);
      setError(PROBLEM_MESSAGE[problem]);
      return;
    }

    const savedTitle = draft.title.trim();
    setTitle("");
    setDays([emptyDay()]);
    setSaved(T.builderSaved(savedTitle));
    setSaving(true);
    setError(null);

    const ok = await saveCoachTemplate(coachId as string, draft);

    setSaving(false);

    if (!ok) {
      setTitle(savedTitle);
      setDays(draft.days);
      setSaved(null);
      setError(T.builderSaveError);
      setToast(T.builderOfflineToast);
      return;
    }

    hapticSuccess();
    setSaved(T.builderSaved(savedTitle));
    setToast(T.builderSavedToast);
    onSaved?.(savedTitle);
  }, [days, onSaved, saving, title]);

  const saveDisabled = saving || draftProblem({ title, days }, getCoachId()) !== null;

  return (
    <section aria-labelledby="builder-heading" className="flex min-w-0 flex-col gap-3">
      <h3 id="builder-heading" style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}>
        {isTemplate ? T.templateBuilderTitle : T.builderTitle}
      </h3>

      <GlassCard>
        <div className="flex flex-col gap-3">
          <Field label={T.builderRoutineTitleLabel} htmlFor="vip-routine-title">
            <input
              id="vip-routine-title"
              type="text"
              value={title}
              placeholder={T.builderRoutineTitlePlaceholder}
              onChange={(event) => setTitle(event.target.value)}
              style={inputStyle}
            />
          </Field>

          {days.length === 0 && <p style={bodyStyle}>{T.builderEmpty}</p>}

          {days.map((day, dayIndex) => (
            <DayEditor
              key={dayIndex}
              day={day}
              dayNumber={dayIndex + 1}
              onChange={(next) =>
                setDays((current) => current.map((d, i) => (i === dayIndex ? next : d)))
              }
              onRemove={() =>
                setDays((current) => current.filter((_, i) => i !== dayIndex))
              }
              onAddExercises={() => {
                setSelectorDayIndex(dayIndex);
                setSelectorOpen(true);
              }}
              onRemoveExercise={(exerciseIndex) =>
                setDays((current) =>
                  current.map((d, i) =>
                    i === dayIndex
                      ? {
                          ...d,
                          exercises: d.exercises.filter((_, idx) => idx !== exerciseIndex),
                        }
                      : d,
                  ),
                )
              }
              onSubstitute={openSubstitute}
              removable={days.length > 1}
            />
          ))}

          <GlassButton
            variant="secondary"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => setDays((current) => [...current, emptyDay()])}
          >
            {T.builderAddDay}
          </GlassButton>

          {athleteId !== null && (
            <GlassButton
              variant="ghost"
              icon={<Sparkles size={16} aria-hidden="true" />}
              disabled={generatingAi || exercises.length === 0 || catalogLoading}
              onClick={() => void generateAIRoutine()}
            >
              {generatingAi ? T.builderGeneratingAi : T.builderGenerateAiButton}
            </GlassButton>
          )}

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
              {error}
            </p>
          )}

          {/*
           * `aria-live` rather than `role="alert"`: the confirmation replaces the outcome of
           * a save the coach deliberately made, so it should be announced without stealing
           * focus from whatever they do next.
           */}
          {saved && (
            <p aria-live="polite" style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
              {saved}
            </p>
          )}

          {toast && (
            <p role="status" aria-live="polite" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
              {toast}
            </p>
          )}

          <GlassButton variant="primary" disabled={saveDisabled} onClick={() => void (isTemplate ? saveTemplate() : save())}>
            {saving ? (isTemplate ? T.templateSaving : T.builderSaving) : (isTemplate ? T.templateSave : T.builderSave)}
          </GlassButton>
        </div>
      </GlassCard>

      {substitutingExercise && (
        <ExerciseSubstitutionModal
          current={exercises.find((e) => e.id === substitutingExercise.exerciseId) ?? ({
            id: substitutingExercise.exerciseId,
            name: substitutingExercise.exerciseName ?? "",
            name_es: null,
            body_part: "",
            target: "",
            equipment: "",
            gif_url: "",
            instructions: [],
            is_active: true,
            is_hidden: false,
          } as Exercise)}
          catalog={exercises}
          open={substituteOpen}
          onSubstitute={doSubstitute}
          onClose={() => setSubstituteOpen(false)}
        />
      )}

      {selectorOpen && selectorDayIndex !== null && (
        <UnifiedExerciseSelectorSheet
          isOpen
          mode="multiple"
          onClose={() => setSelectorOpen(false)}
          onSelectMultiple={(selected) =>
            handleSelectExercises(selected, selectorDayIndex!)
          }
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------------ day editor

function DayEditor({
  day,
  dayNumber,
  onChange,
  onRemove,
  onAddExercises,
  onRemoveExercise,
  onSubstitute,
  removable,
}: {
  day: CoachRoutineDay;
  dayNumber: number;
  onChange: (next: CoachRoutineDay) => void;
  onRemove: () => void;
  onAddExercises: () => void;
  onRemoveExercise: (index: number) => void;
  onSubstitute: (dayIndex: number, exerciseIndex: number) => void;
  /**
   * Whether this day can go.
   *
   * The last day cannot be removed, because removing it would leave the builder with nothing
   * to type into and no way back -- a dead end the coach cannot undo except by reloading.
   */
  removable: boolean;
}) {
  /*
   * Every `id` in this subtree is prefixed by day and exercise position.
   *
   * Not tidiness: a duplicated `id` makes a `<label for>` ambiguous, so the second day's
   * "Series" field would label the *first* day's input, and clicking either label would move
   * the caret into the wrong box. Four days of four numbers each is sixteen collisions on
   * one screen.
   */
  const prefix = `vip-d${dayNumber}`;

  return (
    <div className="flex flex-col gap-2" style={dayStyle}>
      <div className="flex items-end gap-2">
        <Field label={T.builderDayNameLabel} htmlFor={`${prefix}-label`}>
          <input
            id={`${prefix}-label`}
            type="text"
            value={day.label}
            placeholder={T.builderDayNamePlaceholder}
            onChange={(event) => onChange({ ...day, label: event.target.value })}
            style={inputStyle}
          />
        </Field>

        {removable && (
          <GlassButton
            variant="ghost"
            icon={<Trash2 size={16} aria-hidden="true" />}
            onClick={onRemove}
          >
            {T.builderRemoveDay(dayNumber)}
          </GlassButton>
        )}
      </div>

      {day.exercises.map((exercise, exerciseIndex) => (
        <div key={exerciseIndex} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
              {exercise.exerciseName || exercise.exerciseId || T.builderNoExerciseChosen}
            </p>
            <div className="flex items-center gap-1">
              {exercise.exerciseId !== "" && (
                <GlassButton
                  variant="ghost"
                  icon={<RefreshCw size={14} aria-hidden="true" />}
                  onClick={() => onSubstitute(dayNumber - 1, exerciseIndex)}
                  style={{ padding: 4, minHeight: "auto", minWidth: "auto", width: 32, height: 32 }}
                  aria-label={T.substituteReplace}
                />
              )}
              <GlassButton
                variant="ghost"
                icon={<Trash2 size={16} aria-hidden="true" />}
                onClick={() => onRemoveExercise(exerciseIndex)}
              />
            </div>
          </div>
          <NumbersRow
            idPrefix={`${prefix}-e${exerciseIndex}`}
            exercise={exercise}
            onChange={(next) =>
              onChange({
                ...day,
                exercises: day.exercises.map((e, i) => (i === exerciseIndex ? next : e)),
              })
            }
          />
        </div>
      ))}

      <GlassButton
        variant="ghost"
        icon={<Plus size={16} aria-hidden="true" />}
        onClick={onAddExercises}
      >
        {T.builderAddExercise}
      </GlassButton>
    </div>
  );
}

// -------------------------------------------------------------- exercise picker


// ------------------------------------------------------------------ numbers row

/** Sets, reps and rest. Numeric inputs with `inputMode`, so a phone offers a keypad. */
function NumbersRow({
  idPrefix,
  exercise,
  onChange,
}: {
  idPrefix: string;
  exercise: CoachRoutineExercise;
  onChange: (next: CoachRoutineExercise) => void;
}) {
  const number = (label: string, key: "sets" | "repsMin" | "repsMax" | "restSeconds", min: number) => (
    <Field label={label} htmlFor={`${idPrefix}-${key}`}>
      <input
        id={`${idPrefix}-${key}`}
        type="number"
        inputMode="numeric"
        min={min}
        value={exercise[key]}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          // A half-typed number is NaN, and writing NaN into the draft would reach
          // `target_sets` as null via PostgREST. An empty field keeps the previous value.
          if (!Number.isFinite(parsed)) return;
          onChange({ ...exercise, [key]: parsed });
        }}
        style={inputStyle}
      />
    </Field>
  );

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {number(T.builderExerciseSets, "sets", 1)}
      {number(T.builderExerciseRepsMin, "repsMin", 1)}
      {number(T.builderExerciseRepsMax, "repsMax", 1)}
      {number(T.builderExerciseRest, "restSeconds", 0)}
    </div>
  );
}

// ------------------------------------------------------------------- shared

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex min-w-0 flex-1 flex-col gap-1">
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

const bodyStyle = { margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary } as const;
const labelStyle = { fontSize: TYPE.caption.size, fontWeight: 600, color: TEXT.tertiary } as const;

const inputStyle = {
  width: "100%",
  minHeight: 40,
  padding: "6px 10px",
  borderRadius: 10,
  border: `1px solid ${TEXT.tertiary}33`,
  background: "#ffffff08",
  color: TEXT.primary,
  fontSize: TYPE.subhead.size,
} as const;

const dayStyle = {
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${TEXT.tertiary}22`,
} as const;