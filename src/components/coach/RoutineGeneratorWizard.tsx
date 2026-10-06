/**
 * RoutineGeneratorWizard.tsx — three steps from four parameters to a saved routine.
 *
 * The steps exist as separate screens rather than one form because the middle one has no
 * form at all: it is a spinner over an operation nobody can influence. Collapsing them
 * would mean the parameters stayed on screen under a loading state, inviting the athlete
 * to edit what has already been sent and see the change silently ignored.
 *
 * Three rules the flow is built around:
 *
 *  1. **Cancel aborts, it does not hide.** The `AbortController` is held in a ref and
 *     fired, so the request stops rather than finishing into a state nobody is looking at.
 *     That is also why the abort check inside `generateRoutine` exists twice.
 *
 *  2. **"Regenerar" keeps the parameters.** Going back to step 1 would lose what the
 *     athlete just told us, and re-typing four choices to get a different answer is how
 *     people give up on a feature.
 *
 *  3. **A routine is not editable here.** The preview is read-only by design. Hand-editing
 *     sets in a preview means maintaining an undo history for edits nobody asked for; the
 *     routine becomes editable once saved, in the editor that already exists for
 *     hand-written routines.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { ACCENT, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { SYMMETRY_LABELS as T } from "@/lib/i18n";
import {
  RoutineGenerationError,
  generateRoutine,
  type DaysPerWeek,
  type GeneratedRoutine,
  type RoutineGenerationRequest,
  type RoutineGoal,
  type RoutineTransport,
  type SessionDuration,
} from "@/lib/ai/routineGenerator";
import { saveGeneratedRoutine } from "@/lib/routines/saveGeneratedRoutine";
import type { Exercise } from "@/types/supabase";

/** The three steps, as a discriminant rather than a number so no transition is accidental. */
type Step = "params" | "generating" | "preview";

const GOALS: RoutineGoal[] = ["volume", "definition", "maintenance"];
const DURATIONS: SessionDuration[] = [45, 60, 90];
const DAY_MIN = 2;
const DAY_MAX = 6;

export interface RoutineGeneratorWizardProps {
  userId: string;
  /** The rows an exercise id may point at. Already loaded by whoever opened the sheet. */
  catalog: Pick<Exercise, "id" | "body_part">[];
  /** Exercise names by id, for the preview. Missing names render as a placeholder. */
  exerciseNames?: Readonly<Record<string, string>>;
  /** Muscle slugs to prioritise. Empty means "spread it evenly". */
  muscleWeaknesses?: string[];
  experienceLevel?: RoutineGenerationRequest["experienceLevel"];
  /** Injected in tests. Defaults to the real Edge Function call. */
  transport?: RoutineTransport;
  /** Injected in tests. Defaults to the two-table write. */
  save?: (userId: string, routine: GeneratedRoutine) => Promise<boolean>;
  /** Called after a successful save, so a caller can close or navigate. */
  onSaved?: () => void;
}

export function RoutineGeneratorWizard({
  userId,
  catalog,
  exerciseNames = {},
  muscleWeaknesses = [],
  experienceLevel = "beginner",
  transport,
  save,
  onSaved,
}: RoutineGeneratorWizardProps) {
  const [step, setStep] = useState<Step>("params");
  const [goal, setGoal] = useState<RoutineGoal>("volume");
  const [days, setDays] = useState<DaysPerWeek>(3);
  const [duration, setDuration] = useState<SessionDuration>(60);
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [substituted, setSubstituted] = useState(0);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [error, setError] = useState<null | (string)>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Held in a ref so a re-render mid-request cannot hand the cancellation to a different
  // controller, and so Cancel never has to be disabled while it is already fired.
  const abortRef = useRef<AbortController | null>(null);

  // An unmounted wizard must not call setState, and more importantly must not leave a
  // request running that nobody will ever read.
  useEffect(() => () => abortRef.current?.abort(), []);

  const request = useCallback(
    (): RoutineGenerationRequest => ({
      goal,
      daysPerWeek: days,
      sessionDurationMinutes: duration,
      experienceLevel,
      muscleWeaknesses,
      availableExerciseIds: catalog.map((exercise) => exercise.id),
    }),
    [goal, days, duration, experienceLevel, muscleWeaknesses, catalog],
  );

  const run = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;

    setStep("generating");
    setError(null);
    setSaved(false);
    setSaveError(false);

    try {
      const result = await generateRoutine(request(), {
        signal: controller.signal,
        ...(transport ? { ask: transport } : {}),
        catalog,
      });

      if (controller.signal.aborted) return;
      setRoutine(result.routine);
      setSubstituted(result.substituted);
      setUnresolved(result.unresolved);
      setStep("preview");
    } catch (cause) {
      if (isAbort(cause, controller.signal)) return;
      setError(classify(cause));
      // Stays on "generating" so the retry button lives next to the message that explains
      // why the button is there.
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [request, transport, catalog]);

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("params");
  };

  const persist = async () => {
    if (routine === null) return;
    setSaving(true);
    setSaveError(false);
    // Named so the default is one indirection away rather than a mock in every test.
    const writer = save ?? saveGeneratedRoutine;
    const ok = await writer(userId, routine);
    setSaving(false);
    if (!ok) {
      setSaveError(true);
      return;
    }
    setSaved(true);
    onSaved?.();
  };

  if (step === "generating") {
    return (
      <GeneratingStep error={error} onCancel={cancel} onRetry={() => void run()} />
    );
  }

  if (step === "preview" && routine !== null) {
    return (
      <PreviewStep
        routine={routine}
        substituted={substituted}
        unresolved={unresolved}
        exerciseNames={exerciseNames}
        saving={saving}
        saved={saved}
        saveError={saveError}
        onRename={(name) => setRoutine({ ...routine, name })}
        onSave={() => void persist()}
        onRegenerate={() => void run()}
        onEditParams={() => setStep("params")}
      />
    );
  }

  return (
    <ParamsStep
      goal={goal}
      days={days}
      duration={duration}
      onGoal={setGoal}
      onDays={setDays}
      onDuration={setDuration}
      onNext={() => void run()}
    />
  );
}

// ---------------------------------------------------------------- step one

interface ParamsStepProps {
  goal: RoutineGoal;
  days: DaysPerWeek;
  duration: SessionDuration;
  onGoal: (goal: RoutineGoal) => void;
  onDays: (days: DaysPerWeek) => void;
  onDuration: (duration: SessionDuration) => void;
  onNext: () => void;
}

function ParamsStep({
  goal,
  days,
  duration,
  onGoal,
  onDays,
  onDuration,
  onNext,
}: ParamsStepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}>
      <Field label={T.goalLabel}>
        {/* A radio group, not three buttons: one answer is expected, and arrow keys have to
            move between the options rather than tabbing past all three. */}
        <div role="radiogroup" aria-label={T.goalLabel} style={segmentedStyle}>
          {GOALS.map((option) => (
            <Segment
              key={option}
              selected={option === goal}
              label={T.goals[option] ?? option}
              onSelect={() => onGoal(option)}
            />
          ))}
        </div>
      </Field>

      <Field label={T.daysLabel}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE.md }}>
          <StepperButton
            label={T.daysDecrease}
            disabled={days <= DAY_MIN}
            onClick={() => onDays((days - 1) as DaysPerWeek)}
          >
            <Minus size={16} aria-hidden="true" />
          </StepperButton>
          <output
            aria-live="polite"
            style={{ minWidth: 68, textAlign: "center", fontSize: 17, fontWeight: 600 }}
          >
            {T.daysValue(days)}
          </output>
          <StepperButton
            label={T.daysIncrease}
            disabled={days >= DAY_MAX}
            onClick={() => onDays((days + 1) as DaysPerWeek)}
          >
            <Plus size={16} aria-hidden="true" />
          </StepperButton>
        </div>
      </Field>

      <Field label={T.durationLabel}>
        {/* Chips rather than a radio group: the three are ordered and read as a scale, and
            they are the only choice in this form where the visual order is the meaning. */}
        <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
          {DURATIONS.map((option) => (
            <Chip
              key={option}
              selected={option === duration}
              label={T.durationMinutes(option)}
              onSelect={() => onDuration(option)}
            />
          ))}
        </div>
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <GlassButton variant="primary" onClick={onNext}>
          {T.next}
        </GlassButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- step two

function GeneratingStep({
  error,
  onCancel,
  onRetry,
}: {
  error: string | null;
  onCancel: () => void;
  onRetry: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
      <p
        role="status"
        aria-live="polite"
        style={{ margin: 0, fontSize: 13, color: TEXT.secondary }}
      >
        {T.generating}
      </p>

      {error !== null ? (
        <GlassCard>
          {/* `role="alert"` rather than the status above: a failure interrupts, and a
              polite live region would wait for the user to stop typing. */}
          <p role="alert" style={{ margin: 0, fontSize: 13, color: TEXT.primary }}>
            {error}
          </p>
          <div style={{ display: "flex", gap: SPACE.sm, marginTop: SPACE.md }}>
            <GlassButton variant="primary" onClick={onRetry}>
              {T.retry}
            </GlassButton>
            <GlassButton variant="ghost" onClick={onCancel}>
              {T.cancel}
            </GlassButton>
          </div>
        </GlassCard>
      ) : (
        <>
          <Skeleton variant="block" />
          <Skeleton variant="block" />
          <Skeleton width="60%" />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <GlassButton variant="ghost" onClick={onCancel}>
              {T.cancel}
            </GlassButton>
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------- step three

function PreviewStep({
  routine,
  substituted,
  unresolved,
  exerciseNames,
  saving,
  saved,
  saveError,
  onRename,
  onSave,
  onRegenerate,
  onEditParams,
}: {
  routine: GeneratedRoutine;
  substituted: number;
  /**
   * Ids the generator could not resolve to anything in the catalog.
   *
   * Carried from the generator rather than re-derived here, because only the generator
   * knows which ids it looked for and failed to find -- and an empty `exerciseId` is not
   * the same thing: the validator refuses those before a routine exists, so a preview
   * could never contain one.
   */
  unresolved: string[];
  exerciseNames: Readonly<Record<string, string>>;
  saving: boolean;
  saved: boolean;
  saveError: boolean;
  onRename: (name: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
  onEditParams: () => void;
}) {
  // An unresolved id would be a dangling foreign key, so saving is refused rather than
  // attempted. The athlete can regenerate, which is the only way forward that leaves a
  // routine they can actually use.
  const blocked = unresolved.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
      <Field label={T.nameLabel}>
        <input
          type="text"
          value={routine.name}
          placeholder={T.namePlaceholder}
          onChange={(event) => onRename(event.target.value)}
          style={inputStyle}
        />
      </Field>

      {/*
        Stated, not hidden. A substitution is the module repairing the model's answer, and
        an athlete who saves a routine that is not the one they were shown has no way to
        find out. One line, once, only when it happened.
      */}
      {substituted > 0 && (
        <p style={{ margin: 0, fontSize: 11, color: TEXT.tertiary }}>
          {substituted === 1 ? T.substitutedOne : T.substitutedMany(substituted)}
        </p>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: SPACE.sm }}>
        {routine.days.map((day) => (
          <li key={day.dayNumber}>
            <GlassCard>
              <div style={{ display: "flex", justifyContent: "space-between", gap: SPACE.sm }}>
                <strong style={{ fontSize: 13 }}>{T.dayHeading(day.dayNumber)}</strong>
                <span style={{ fontSize: 11, color: TEXT.tertiary }}>
                  {T.dayExerciseCount(day.exercises.length)}
                </span>
              </div>
              {day.focus !== "" && (
                <p style={{ margin: "2px 0 0", fontSize: 11, color: TEXT.tertiary }}>
                  {day.focus}
                </p>
              )}
              <ul
                style={{
                  listStyle: "none",
                  margin: `${SPACE.sm}px 0 0`,
                  padding: 0,
                  display: "grid",
                  gap: 4,
                }}
              >
                {day.exercises.map((exercise, index) => (
                  <li
                    key={`${day.dayNumber}-${index}`}
                    style={{ display: "flex", justifyContent: "space-between", gap: SPACE.sm, fontSize: 12 }}
                  >
                    <span style={{ color: TEXT.primary }}>
                      {unresolved.includes(exercise.exerciseId)
                        ? T.unknownExercise
                        : (exerciseNames[exercise.exerciseId] ?? exercise.exerciseId)}
                    </span>
                    <span style={{ color: TEXT.tertiary }}>
                      {T.prescription(exercise.sets, exercise.repsMin, exercise.repsMax)}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </li>
        ))}
      </ul>

      {saveError && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: TEXT.primary }}>
          {T.saveError}
        </p>
      )}
      {saved && (
        <p role="status" style={{ margin: 0, fontSize: 12, color: ACCENT.text }}>
          {T.saved}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, justifyContent: "flex-end" }}>
        <GlassButton variant="ghost" onClick={onEditParams}>
          {T.back}
        </GlassButton>
        <GlassButton variant="secondary" onClick={onRegenerate}>
          {T.regenerate}
        </GlassButton>
        <GlassButton
          variant="primary"
          disabled={saving || saved || blocked}
          onClick={onSave}
          style={{ opacity: saving || saved || blocked ? 0.5 : 1 }}
        >
          {saving ? T.saving : T.save}
        </GlassButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ helpers

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: TYPE.label.tracking,
          color: TEXT.tertiary,
        }}
      >
        {label}
      </p>
      <div style={{ marginTop: SPACE.sm }}>{children}</div>
    </div>
  );
}

const segmentedStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 2,
  padding: 3,
  borderRadius: RADIUS.control,
  backgroundColor: `${TEXT.tertiary}14`,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.control,
  border: `1px solid ${TEXT.tertiary}33`,
  backgroundColor: "rgba(0,0,0,0.25)",
  color: TEXT.primary,
  padding: "10px 12px",
  fontSize: 13,
  fontFamily: "inherit",
};

function Segment({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        minHeight: MOTION.minTouchTarget,
        borderRadius: RADIUS.pill,
        border: `1px solid ${selected ? ACCENT.border : "transparent"}`,
        backgroundColor: selected ? `${ACCENT.base}22` : "transparent",
        color: selected ? ACCENT.text : TEXT.secondary,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Chip({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        minHeight: MOTION.minTouchTarget,
        padding: "0 14px",
        borderRadius: RADIUS.pill,
        border: `1px solid ${selected ? ACCENT.border : `${TEXT.tertiary}33`}`,
        backgroundColor: selected ? `${ACCENT.base}22` : "transparent",
        color: selected ? ACCENT.text : TEXT.secondary,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: MOTION.minTouchTarget,
        height: MOTION.minTouchTarget,
        borderRadius: RADIUS.control,
        border: `1px solid ${TEXT.tertiary}33`,
        backgroundColor: "transparent",
        color: disabled ? TEXT.disabled : TEXT.secondary,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** The message shown for a failure. The code is mapped here, never by the module. */
function classify(cause: unknown): string {
  // Every code collapses to one message. A rate limit and a malformed reply are different
  // failures with the same remedy -- try again -- and a wizard that distinguishes them
  // would show an athlete a countdown for a problem that has nothing to do with time.
  if (cause instanceof RoutineGenerationError) return T.generateError;
  return T.generateError;
}

/** An abort, or something thrown after one. Not a failure to show. */
function isAbort(cause: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (cause instanceof Error && cause.name === "AbortError");
}