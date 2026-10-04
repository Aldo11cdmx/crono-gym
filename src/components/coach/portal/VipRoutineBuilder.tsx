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

import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { ACCENT, TEXT } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { getCoachId } from "@/lib/coach/useCoachAuth";
import {
  draftProblem,
  type CoachRoutineDay,
  type CoachRoutineDraft,
  type CoachRoutineExercise,
  type DraftProblem,
} from "@/lib/routines/coachRoutineDraft";
import {
  normaliseExerciseName,
  useExerciseCatalog,
} from "@/hooks/useExerciseCatalog";
import type { Exercise } from "@/types/supabase";

import { saveCoachRoutine } from "@/lib/routines/saveCoachRoutine";

/** How many search hits to offer before the list stops being a list. */
const MAX_HITS = 8;

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

function emptyExercise(): CoachRoutineExercise {
  return { exerciseId: "", sets: 4, repsMin: 8, repsMax: 12, restSeconds: 90 };
}

export interface VipRoutineBuilderProps {
  /** The athlete the routine is written for. */
  athleteId: string | null;
  /** Reports the saved routine's title, so the portal can acknowledge it. */
  onSaved?: (title: string) => void;
}

export function VipRoutineBuilder({ athleteId, onSaved }: VipRoutineBuilderProps) {
  /*
   * The catalogue gate is the athlete, not the coach: the hook only reads `exercises`, and
   * passing the athlete keeps it consistent with every other read in this panel. Passing the
   * coach would work today and break the moment the catalog became per-user.
   */
  const { exercises, loading: catalogLoading } = useExerciseCatalog(athleteId);

  const [title, setTitle] = useState("");
  const [days, setDays] = useState<CoachRoutineDay[]>([emptyDay()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

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

    setSaving(true);
    setError(null);
    setSaved(null);

    const ok = await saveCoachRoutine(athleteId, coachId as string, draft);

    setSaving(false);

    if (!ok) {
      setError(T.builderSaveError);
      return;
    }

    /*
     * Cleared on success rather than kept.
     *
     * Keeping the draft would leave a coach who has just handed over a plan looking at it
     * again next to a "guardada" message, with no way to tell whether the button would save
     * it twice. Starting empty makes the second save an explicit act.
     */
    const savedTitle = draft.title.trim();
    setTitle("");
    setDays([emptyDay()]);
    setSaved(T.builderSaved(savedTitle));
    onSaved?.(savedTitle);
  }, [athleteId, days, onSaved, saving, title]);

  if (athleteId === null) {
    return (
      <GlassCard>
        {/* Its own copy: the CRM renders above this in the portal column. See `builderSelectPrompt`. */}
        <p style={bodyStyle}>{T.builderSelectPrompt}</p>
      </GlassCard>
    );
  }

  const saveDisabled = saving || draftProblem({ title, days }, getCoachId()) !== null;

  return (
    <section aria-labelledby="builder-heading" className="flex min-w-0 flex-col gap-3">
      <h3 id="builder-heading" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT.primary }}>
        {T.builderTitle}
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
              // Stable across a reorder because it *is* the position, and reordering days
              // is the whole point of the remove button.
              key={dayIndex}
              day={day}
              dayNumber={dayIndex + 1}
              exercises={exercises}
              catalogLoading={catalogLoading}
              onChange={(next) =>
                setDays((current) => current.map((d, i) => (i === dayIndex ? next : d)))
              }
              onRemove={() =>
                setDays((current) => current.filter((_, i) => i !== dayIndex))
              }
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

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: ACCENT.text }}>
              {error}
            </p>
          )}

          {/*
           * `aria-live` rather than `role="alert"`: the confirmation replaces the outcome of
           * a save the coach deliberately made, so it should be announced without stealing
           * focus from whatever they do next.
           */}
          {saved && (
            <p aria-live="polite" style={{ margin: 0, fontSize: 13, color: TEXT.secondary }}>
              {saved}
            </p>
          )}

          <GlassButton variant="primary" disabled={saveDisabled} onClick={() => void save()}>
            {saving ? T.builderSaving : T.builderSave}
          </GlassButton>
        </div>
      </GlassCard>
    </section>
  );
}

// ------------------------------------------------------------------ day editor

function DayEditor({
  day,
  dayNumber,
  exercises,
  catalogLoading,
  onChange,
  onRemove,
  removable,
}: {
  day: CoachRoutineDay;
  dayNumber: number;
  exercises: Exercise[];
  catalogLoading: boolean;
  onChange: (next: CoachRoutineDay) => void;
  onRemove: () => void;
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
          <ExercisePicker
            idPrefix={`${prefix}-e${exerciseIndex}`}
            exercise={exercise}
            exercises={exercises}
            loading={catalogLoading}
            onPick={(exerciseId, name) =>
              onChange({
                ...day,
                exercises: day.exercises.map((e, i) =>
                  i === exerciseIndex ? { ...e, exerciseId, exerciseName: name } : e,
                ),
              })
            }
            onRemove={() =>
              onChange({
                ...day,
                exercises: day.exercises.filter((_, i) => i !== exerciseIndex),
              })
            }
          />
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
        onClick={() => onChange({ ...day, exercises: [...day.exercises, emptyExercise()] })}
      >
        {T.builderAddExercise}
      </GlassButton>
    </div>
  );
}

// -------------------------------------------------------------- exercise picker

/**
 * The catalogue search, per exercise row.
 *
 * The picked name travels on the row rather than being looked up on render, because a coach
 * who has just built a four-day split should see the same names when they come back to this
 * screen -- and because re-deriving it would mean trusting a search index to be stable.
 */
function ExercisePicker({
  idPrefix,
  exercise,
  exercises,
  loading,
  onPick,
  onRemove,
}: {
  idPrefix: string;
  exercise: CoachRoutineExercise;
  exercises: Exercise[];
  loading: boolean;
  onPick: (exerciseId: string, name: string) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");

  const hits = useMemo(() => {
    const wanted = normaliseExerciseName(query);
    // An empty query offers nothing: listing 1,300 rows under an empty box is not a
    // shortcut, it is a wall, and the coach already knows roughly what they are typing.
    if (wanted === "") return [];

    const out: Exercise[] = [];
    for (const candidate of exercises) {
      if (normaliseExerciseName(candidate.name).includes(wanted)) {
        out.push(candidate);
        if (out.length >= MAX_HITS) break;
      }
    }
    return out;
  }, [exercises, query]);

  const pickedName =
    exercise.exerciseName ?? exercises.find((e) => e.id === exercise.exerciseId)?.name;

  return (
    <div className="flex flex-col gap-1">
      {/*
       * The chosen exercise, above the search rather than inside it.
       *
       * Clearing the query on pick is what keeps the field usable for the *next* exercise,
       * and that is only safe if the current choice is visible somewhere else -- otherwise
       * an empty box reads as "nothing chosen" and the coach cannot tell what they already
       * wrote into this row.
       */}
      <p style={hintStyle}>
        {exercise.exerciseId === ""
          ? T.builderNoExerciseChosen
          : (pickedName ?? exercise.exerciseId)}
      </p>

      <div className="flex items-end gap-2">
        <Field label={T.builderExerciseSearchLabel} htmlFor={`${idPrefix}-search`}>
          <input
            id={`${idPrefix}-search`}
            type="text"
            value={query}
            placeholder={T.builderExerciseSearchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            style={inputStyle}
          />
        </Field>

        <GlassButton
          variant="ghost"
          icon={<Trash2 size={16} aria-hidden="true" />}
          onClick={onRemove}
        >
          {T.builderRemoveExercise}
        </GlassButton>
      </div>

      {/*
       * A listbox rather than a `<datalist>`: the coach needs to know *which* row they are
       * about to write a set against, and a datalist has nowhere to show the muscle that
       * disambiguates two exercises sharing a name.
       */}
      {hits.length > 0 && (
        <ul role="listbox" aria-label={T.builderExerciseSearchLabel} style={listStyle}>
          {hits.map((hit) => (
            <li key={hit.id} role="option" aria-selected={hit.id === exercise.exerciseId}>
              <button
                type="button"
                onClick={() => {
                  onPick(hit.id, hit.name);
                  setQuery("");
                }}
                style={hitStyle}
              >
                {hit.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim() !== "" && hits.length === 0 && !loading && (
        <p style={hintStyle}>{T.builderNoExercisesFound}</p>
      )}
    </div>
  );
}

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

const bodyStyle = { margin: 0, fontSize: 13, color: TEXT.tertiary } as const;
const labelStyle = { fontSize: 12, fontWeight: 600, color: TEXT.tertiary } as const;
const hintStyle = { margin: 0, fontSize: 12, color: TEXT.tertiary } as const;
const listStyle = { margin: 0, padding: 0, listStyle: "none" } as const;

const inputStyle = {
  width: "100%",
  minHeight: 40,
  padding: "6px 10px",
  borderRadius: 10,
  border: `1px solid ${TEXT.tertiary}33`,
  background: "#ffffff08",
  color: TEXT.primary,
  fontSize: 14,
} as const;

const dayStyle = {
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${TEXT.tertiary}22`,
} as const;

const hitStyle = {
  display: "block",
  width: "100%",
  textAlign: "left" as const,
  padding: "6px 8px",
  borderRadius: 8,
  fontSize: 13,
  color: TEXT.primary,
} as const;