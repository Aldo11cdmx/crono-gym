/**
 * SetTable.tsx — the sets for the exercise in front of you.
 *
 * Replaces `SetLoggerRow` on the immersive screen. Not a rewrite of it: `SetLoggerRow`
 * stays for the case where an athlete wants every exercise's sets on one page, and it
 * keeps its own 29 tests. This one is the same data arranged for a screen showing a single
 * exercise, where the numbers are the only thing that matters.
 *
 * What is different, and why
 * --------------------------
 * 1. **The "Anterior" row is a row.** `SetLoggerRow` puts the previous session in a chip
 *    inside the stepper, which is right when the stepper is the subject. Here the stepper
 *    is one cell of four, so the reference gets its own full-width row above them -- grey,
 *    non-interactive, and one row tall instead of interleaved with input controls.
 * 2. **The inputs have no border.** A box around every cell draws four outlines per set,
 *    and on a phone the table stops reading as a table and starts reading as a stack of
 *    boxes. The background alone separates them, and the focus ring -- global, generated
 *    from `FOCUS` -- is what appears when a cell is actually being edited.
 * 3. **The kind chips stay.** They look like clutter next to everything else, but `kind`
 *    is what `finish()` reads to decide `is_warmup`, and a warm-up set that cannot be
 *    marked is a warm-up set that gets counted as volume and corrupts the 1RM estimate
 *    for every future session. They are small for that reason and not for aesthetics.
 *
 * The weight cell
 * ---------------
 * `WeightStepper` is reused whole rather than reimplemented, which is what brings four
 * things this screen cannot do without: snapping a typed weight onto the plates the gym
 * actually has, the unit conversion, the one-tap "repeat last time" autofill, and the
 * warm-up ramp from `warmupSets` -- the 40/60/80% steps, each already snapped to
 * something the bar can build.
 */

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { Check, Copy, Flame, Flag, Layers, Trash2, TrendingUp, X } from "lucide-react";
import { SET_LOGGER_LABELS, SET_TYPE_LABELS, FATIGUE_LABELS } from "../../lib/i18n";
import { SET_KINDS, type SetKind } from "../../lib/workout/setKind";
import { isRecordBreak } from "../../lib/workout/recordBreak";
import {
  FATIGUE,
  fatigueShortfall,
  getSetFatigue,
  summarizeFatigue,
  type FatigueLevel,
} from "../../lib/workout/fatigue";
import {
  FALLBACK_REST_SECONDS,
  REST_STEP_SECONDS,
  saveRestSeconds,
} from "../../lib/workout/restPreferences";
import type { OverloadTarget } from "../../lib/overload";
import type { BarType } from "../../lib/workout/weightUtils";
import type { SetEntry } from "../../lib/workout/types";
import { WeightStepper } from "./WeightStepper";
import { SetNoteField } from "./SetNoteField";
import { FatigueBadge } from "./FatigueBadge";
import { RecordBadge, type RecordNotice } from "../hub/RecordBadge";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import {
  ACCENT,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SPACE,
  STATUS,
  SURFACE,
  TEXT,
  TYPE,
} from "../../design/tokens";

/** What the athlete did last time. Both numbers are in kg; the caller converts. */
export interface SetTableProps {
  sets: readonly SetEntry[];
  /** Last session's best working set, in kg. Drives the "Anterior" row and the autofill. */
  previousKg?: number | null;
  previousReps?: number | null;
  /**
   * The exercise's name, for the record badge's title.
   *
   * Optional because the table is also rendered where no single exercise is in
   * focus. Without it the badge has nothing to name and stays silent.
   */
  exerciseName?: string;
  /**
   * The all-time best working set for this exercise, in kg.
   *
   * The *pre-session* best, supplied by `ActiveWorkout` from
   * `usePreviousPerformance`'s `allTimeBest` -- not a best computed from this
   * session's sets. That is the whole point: the badge has to notice the moment
   * the ceiling moves, and a ceiling computed from the sets already done would
   * move on the first set and never again.
   *
   * Absent means "no history to beat", which is a first, not a record.
   */
  allTimeBestKg?: number | null;
  /** Reps on the all-time best set. Null when it was logged without a count. */
  allTimeBestReps?: number | null;
  /**
   * Formats a kg value into the unit this user reads.
   *
   * Supplied rather than imported because the unit rule already exists once, in
   * `ActiveWorkout`'s `displayKg`, and a second copy here is a second rule that will
   * disagree the first time someone converts a 92.5.
   */
  formatWeight: (kg: number) => string;
  /** Progressive-overload target, applied to the opening set only. */
  suggestion?: OverloadTarget | null;
  barType?: BarType;
  /**
   * The exercise's id, when the table shows a single exercise.
   *
   * Names the rest-length preference the fatigue summary's action
   * writes: "30 s más" is a promise about *this* movement, not
   * about the session, so it has to be stored under the movement
   * it was made for. Absent means the summary's action stays
   * silent, because there is nothing to remember.
   */
  exerciseId?: string;
  /**
   * The exercise's configured rest, in seconds.
   *
   * The base the fatigue summary's "30 s más" builds on: the
   * preference stores an absolute duration, so the action needs
   * to know what it is adding to.
   */
  restSeconds?: number;
  /**
   * The previous session's note for each set, by index, read-only.
   *
   * Shown as a grey reminder inside a set's note field when that set
   * has no note yet -- the "what did I write about this set last time"
   * answer, without making the athlete open anything. Absent or null
   * entries render nothing.
   */
  previousNotes?: readonly (string | null)[];
  onChange: (index: number, entry: SetEntry) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onAdd: () => void;
}

const KIND_ICON: Record<SetKind, typeof Flame> = {
  normal: TrendingUp,
  // A failure set is a good day, not a cold one: an icon that reads as "worse" on the
  // hardest set of the session is exactly backwards.
  warmup: Flame,
  failure: Flag,
  drop: Layers,
};

export function SetTable({
  sets,
  previousKg,
  previousReps,
  exerciseName,
  allTimeBestKg,
  allTimeBestReps,
  formatWeight,
  suggestion,
  barType,
  exerciseId,
  restSeconds,
  previousNotes,
  onChange,
  onRemove,
  onDuplicate,
  onAdd,
}: SetTableProps) {
  const reducedMotion = useReducedMotion();

  /*
   * The record notice, and the one piece of state this table owns.
   *
   * Everything else here is a controlled display of `ActiveWorkout`'s state --
   * completion, kind, the numbers -- deliberately, because the autosave, the undo
   * window and the sync payload all have to see the same flip. This is the
   * exception: a badge that lives for four seconds and is nobody's business but
   * the athlete's. Owning it here keeps `ActiveWorkout` out of it entirely.
   */
  const [recordNotice, setRecordNotice] = useState<RecordNotice | null>(null);

  /**
   * The fatigue verdict for one set.
   *
   * The target's reps are the plan for every working set of the
   * exercise -- the engine suggests one target and the athlete
   * repeats it -- so a completed set that fell short of it fell
   * short of the plan. The record check reuses the badge's own
   * rule, so "this set is a record" and "this set is tired"
   * cannot disagree about the same set.
   *
   * Incomplete sets are `none` by construction: there is no
   * result to judge yet.
   */
  const fatigueOf = (entry: SetEntry): { level: FatigueLevel; shortfall: number | null } => {
    const plannedReps = suggestion?.reps ?? null;
    if (!entry.completed) return { level: "none", shortfall: null };

    const allTimeBest =
      allTimeBestKg === null || allTimeBestKg === undefined
        ? null
        : { weightKg: allTimeBestKg, reps: allTimeBestReps ?? null };
    const isRecord =
      entry.kind !== "warmup" &&
      allTimeBest !== null &&
      isRecordBreak(Number.parseFloat(entry.weight), Number.parseInt(entry.reps, 10), allTimeBest);

    return {
      level: getSetFatigue(entry, { plannedReps, allTimeBest, isRecord }),
      shortfall: fatigueShortfall(entry, plannedReps),
    };
  };

  // Computed once, not per render pass: the summary counts the
  // same verdicts the rows show.
  const fatigueBySet = sets.map(fatigueOf);
  const fatigueSummary = summarizeFatigue(fatigueBySet.map((f) => f.level));

  // Session-only: dismissing an answer is not a promise never to
  // ask again, and the next session gets a fresh question.
  const [fatigueDismissed, setFatigueDismissed] = useState(false);

  const showFatigueSummary =
    exerciseId !== undefined &&
    !fatigueDismissed &&
    fatigueSummary.fatigued >= FATIGUE.SUMMARY_MIN_SETS;

  /**
   * Acts on the summary: remember a longer rest for this exercise.
   *
   * The preference is an absolute duration -- the configured rest
   * plus the offered step -- so the next rest for this movement
   * starts longer without the athlete touching any setting.
   */
  const applyLongerRest = () => {
    if (!exerciseId) return;
    saveRestSeconds(exerciseId, (restSeconds ?? FALLBACK_REST_SECONDS) + REST_STEP_SECONDS);
    setFatigueDismissed(true);
  };

  /**
   * Flips a set's completion, and notices a record on the way up.
   *
   * The record check runs *before* `onChange`, on the entry as it is being
   * completed -- not in an effect watching `sets`, because an effect would also
   * fire for a set that was completed in a previous render, imported, or
   * restored from a draft, and none of those are "the moment the ceiling moved".
   *
   * `onChange` is called unconditionally and with exactly the same payload
   * whether or not a record was found: the badge is a decoration on the flip,
   * never a condition of it.
   */
  const handleToggle = (index: number, entry: SetEntry) => {
    const completing = !entry.completed;

    if (completing && entry.kind !== "warmup") {
      maybeNoticeRecord(entry);
    }

    onChange(index, { ...entry, completed: completing });
  };

  /**
   * Fires the badge when this set beats the all-time best.
   *
   * Warm-up sets are excluded for the same reason `useAthletePRs` filters
   * `is_warmup`: a warm-up is preparation, and crowning one would put a record
   * on a load the athlete was easing into. Failure and drop sets count, because
   * they are real work and the record table counts them too.
   */
  const maybeNoticeRecord = (entry: SetEntry) => {
    if (!exerciseName) return;
    if (allTimeBestKg === null || allTimeBestKg === undefined) return;

    const weightKg = Number.parseFloat(entry.weight);
    const reps = Number.parseInt(entry.reps, 10);

    if (
      !isRecordBreak(weightKg, reps, {
        weightKg: allTimeBestKg,
        reps: allTimeBestReps ?? null,
      })
    ) {
      return;
    }

    setRecordNotice({
      // The achievement, not a timestamp: the same set re-toggled re-fires the
      // same notice rather than minting a second one, and `RecordBadge` keys
      // its dismiss timer on this.
      id: `${exerciseName}:${weightKg}x${reps}`,
      title: `${exerciseName}: ${formatWeight(weightKg)} × ${reps}`,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <ColumnHeadings />

      {previousKg !== null && previousKg !== undefined && (
        <PreviousRow
          weight={formatWeight(previousKg)}
          reps={previousReps ?? null}
        />
      )}

      {sets.map((entry, index) => {
        const isFirst = index === 0;
        // The hint belongs on the opening set only, and never on a set the athlete has
        // already completed -- telling someone what to do about a set they just did is
        // noise, and on a completed set it is also impossible to act on.
        const showSuggestion =
          isFirst &&
          !!suggestion &&
          suggestion.decision !== "first_time" &&
          !entry.completed;

        // The verdict for this row, computed once for all rows
        // above: the summary below counts the same verdicts.
        const fatigue = fatigueBySet[index];

        return (
          <div
            key={`set-${index}`}
            role="group"
            aria-label={SET_LOGGER_LABELS.setNumber(index + 1)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.sm,
              padding: SPACE.md,
              borderRadius: RADIUS.control,
              background: entry.completed ? STATUS.success.muted : GLASS.fill,
              border: `1px solid ${entry.completed ? STATUS.success.border : GLASS.border}`,
              transition: `background ${MOTION.fast} ${MOTION.standard}`,
            }}
          >
            <div style={headerRow}>
              <span style={{ ...setNumberStyle, color: entry.completed ? STATUS.success.text : ACCENT.text }}>
                {SET_LOGGER_LABELS.setNumber(index + 1)}
              </span>

              {/*
                The verdict rides in the header, beside the number it
                belongs to: a badge about *this set* has to sit on
                *this row*, and the header is the only stretch of the
                row that is not an input.
              */}
              {fatigue.level !== "none" && fatigue.shortfall !== null ? (
                <FatigueBadge shortfall={fatigue.shortfall} level={fatigue.level} />
              ) : null}

              <KindChips
                index={index}
                value={entry.kind}
                onChange={(kind) => onChange(index, { ...entry, kind })}
              />

              <div style={{ flex: 1 }} />

              <SetNoteField
                index={index}
                note={entry.notes ?? null}
                previousNote={previousNotes?.[index] ?? null}
                onChange={(note) =>
                  onChange(index, { ...entry, notes: note })
                }
              />

              <GhostIcon
                onClick={() => onDuplicate(index)}
                ariaLabel={SET_LOGGER_LABELS.duplicateAriaLabel(index + 1)}
              >
                <Copy size={14} aria-hidden="true" />
              </GhostIcon>
              <GhostIcon
                onClick={() => onRemove(index)}
                ariaLabel={SET_LOGGER_LABELS.removeAriaLabel(index + 1)}
              >
                <Trash2 size={14} aria-hidden="true" />
              </GhostIcon>
            </div>

            {showSuggestion && suggestion && (
              <p style={suggestionStyle}>
                {SET_LOGGER_LABELS.deltaChip(suggestion.delta)}
                {!suggestion.estimateConfident && (
                  <span style={{ color: STATUS.warning.text }}>
                    {" "}
                    {SET_LOGGER_LABELS.lowConfidence}
                  </span>
                )}
              </p>
            )}

            <div style={gridStyle}>
              <div style={{ minWidth: 0 }}>
                <CellLabel>Peso</CellLabel>
                <WeightStepper
                  value={Number.parseFloat(entry.weight) || 0}
                  onChange={(kg) => onChange(index, { ...entry, weight: String(kg) })}
                  // `OverloadTarget.weight` is `number | null`: the engine declines to
                  // suggest a load it cannot justify, and a null has to become
                  // `undefined` here rather than be rendered as a suggestion of nothing.
                  suggestedKg={showSuggestion ? (suggestion?.weight ?? undefined) : undefined}
                  suggestionReason={showSuggestion ? suggestion?.reason : undefined}
                  // The reference reaches only the opening set. Repeating it on every row
                  // would imply the same target applies to all of them.
                  previousKg={isFirst ? (previousKg ?? undefined) : undefined}
                  previousReps={isFirst ? (previousReps ?? undefined) : undefined}
                  barType={barType}
                  min={0}
                  onApplyPrevious={
                    !isFirst || previousKg === null || previousKg === undefined
                      ? undefined
                      : (kg, reps) =>
                          onChange(index, {
                            ...entry,
                            weight: String(kg),
                            reps: reps === null ? entry.reps : String(reps),
                          })
                  }
                  onApplySuggestion={
                    showSuggestion
                      ? (kg) =>
                          onChange(index, {
                            ...entry,
                            weight: String(kg),
                            reps: String(suggestion.reps),
                          })
                      : undefined
                  }
                />
              </div>

              <NumberCell
                label={SET_LOGGER_LABELS.repsLabel}
                value={entry.reps}
                onChange={(v) => onChange(index, { ...entry, reps: v })}
              />
              <NumberCell
                label={SET_LOGGER_LABELS.rpeLabel}
                value={entry.rpe}
                onChange={(v) => onChange(index, { ...entry, rpe: v })}
              />
            </div>

            <CompleteToggle
              index={index}
              completed={entry.completed}
              reducedMotion={reducedMotion}
              onToggle={() => handleToggle(index, entry)}
            />
          </div>
        );
      })}

      {/*
        The session-level verdict, under the rows it summarizes.

        It only answers a question worth asking -- "did this session
        tire me out?" -- once at least a couple of sets have said yes,
        and it offers the one action that question implies: rest longer
        next time, for this movement. Dismissing it costs a tap and
        ends it for the session, which is all the finality a
        suggestion deserves.
      */}
      {showFatigueSummary ? (
        <div
          role="status"
          aria-label={FATIGUE_LABELS.summaryAriaLabel(
            fatigueSummary.fatigued,
            fatigueSummary.total,
          )}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: SPACE.md,
            borderRadius: RADIUS.surface,
            border: `1px solid ${STATUS.warning.border}`,
            background: STATUS.warning.muted,
            padding: `${SPACE.md} ${SPACE.lg}`,
          }}
        >
          <p
            style={{
              margin: 0,
              flex: "1 1 100%",
              fontSize: TYPE.body.size,
              lineHeight: TYPE.body.lineHeight,
              color: TEXT.primary,
            }}
          >
            {FATIGUE_LABELS.summary(fatigueSummary.fatigued, fatigueSummary.total)}
          </p>
          {exerciseId ? (
            <button
              type="button"
              onClick={applyLongerRest}
              aria-label={FATIGUE_LABELS.restMoreAriaLabel(REST_STEP_SECONDS)}
              style={{
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: `1px solid ${STATUS.warning.border}`,
                background: "transparent",
                color: STATUS.warning.text,
                fontSize: TYPE.label.size,
                fontWeight: TYPE.label.weight,
                letterSpacing: TYPE.label.tracking,
                cursor: "pointer",
              }}
            >
              {FATIGUE_LABELS.restMoreLabel}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={FATIGUE_LABELS.dismissAriaLabel}
            onClick={() => setFatigueDismissed(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "32px",
              minHeight: "32px",
              borderRadius: RADIUS.sm,
              border: `1px solid ${STATUS.warning.border}`,
              background: "transparent",
              color: STATUS.warning.text,
              cursor: "pointer",
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onAdd}
        style={{
          minHeight: MOTION.minTouchTarget,
          borderRadius: RADIUS.control,
          border: `1px dashed ${GLASS.borderStrong}`,
          background: "transparent",
          color: TEXT.secondary,
          fontSize: TYPE.subhead.size,
          fontWeight: TYPE.subhead.weight,
          cursor: "pointer",
        }}
      >
        + Agregar serie
      </button>

      {/*
        Rendered here, but mounted nowhere in particular: the badge is
        `position: fixed`, so it floats over the workout whichever component
        tree it happens to live in. Putting it in the table rather than in a
        shell-level provider is the whole reason the table needs the all-time
        best as a prop -- the one place both the set just completed and the
        ceiling it would have to beat are already in scope.
      */}
      <RecordBadge notice={recordNotice} />
    </div>
  );
}

/**
 * The previous session's set, as a row rather than as a control.
 *
 * Grey, and quiet on purpose: it is a fact the athlete already knows and does not need
 * to read twice. It sits directly above the row it is a reference *for*, so the eye
 * compares them vertically without being told to.
 *
 * The weight is offered as a button on the opening set below -- one tap to autofill --
 * but the tap target is down there, not here, so the two rows do not both look
 * interactive.
 */
function PreviousRow({
  weight,
  reps,
}: {
  weight: string;
  reps: number | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: SPACE.sm,
        padding: `${SPACE.sm} ${SPACE.md}`,
        borderRadius: RADIUS.control,
        // A sunken well rather than glass: this row is behind the real ones in time, and
        // the surface should say so.
        background: SURFACE.sunken,
        border: `1px solid ${GLASS.border}`,
      }}
    >
      <span style={{ ...setNumberStyle, color: TEXT.disabled }}>Anterior</span>
      <span style={{ ...monoStyle, color: TEXT.tertiary }}>
        {weight}
        {reps === null ? "" : ` × ${reps}`}
      </span>
      <span style={{ fontSize: TYPE.caption.size, color: TEXT.disabled }}>
        {reps === null ? "sin repeticiones registradas" : "la última vez"}
      </span>
    </div>
  );
}

/**
 * Column headings, once per table.
 *
 * Absent before, and they are worth it: the table's inputs are unbordered by design, and
 * an unlabelled unbordered column of numbers is four identical boxes. "Peso" over the
 * stepper is what distinguishes the weight from the reps at a glance.
 */
function ColumnHeadings() {
  return (
    <div style={{ ...gridStyle, padding: `0 ${SPACE.md}` }}>
      <span style={headingStyle}>Peso</span>
      <span style={headingStyle}>Reps</span>
      <span style={headingStyle}>RPE</span>
    </div>
  );
}

/**
 * The completion control, and the only thing on this screen that moves.
 *
 * A scale-and-colour animation on the tick, because the moment of ticking a set is the
 * one piece of feedback the athlete is actually waiting for mid-set. `MOTION.spring`
 * rather than `standard`: it overshoots slightly, which is the vocabulary for "picked up
 * and confirmed" -- the tick lands and settles rather than fading in place.
 *
 * Under `prefers-reduced-motion` the animation is dropped and the colour change is not,
 * because the colour change *is* the information.
 */
function CompleteToggle({
  index,
  completed,
  reducedMotion,
  onToggle,
}: {
  index: number;
  completed: boolean;
  reducedMotion: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={SET_LOGGER_LABELS.completeAriaLabel(index + 1, completed)}
      aria-pressed={completed}
      data-completed={completed ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.sm,
        minHeight: MOTION.minTouchTarget,
        borderRadius: RADIUS.control,
        border: `1px solid ${completed ? STATUS.success.border : ACCENT.base}`,
        background: completed ? STATUS.success.muted : ACCENT.base,
        color: completed ? STATUS.success.text : TEXT.onAccent,
        fontSize: TYPE.subhead.size,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        className={reducedMotion ? undefined : "cronos-set-check"}
        data-check={completed ? "on" : "off"}
        style={{
          display: "inline-flex",
          transformOrigin: "center",
          transform: completed ? "scale(1)" : "scale(0.6)",
          opacity: completed ? 1 : 0.45,
          transition: reducedMotion
            ? undefined
            : `transform ${MOTION.spring}, opacity ${MOTION.fast} ${MOTION.standard}`,
        }}
      >
        <Check size={16} />
      </span>
      {completed ? SET_LOGGER_LABELS.completed : SET_LOGGER_LABELS.complete}
    </button>
  );
}

/**
 * The set-kind chips.
 *
 * `role="group"` rather than a radio group: they are not exclusive in the way a radio
 * group is exclusive-and-one-is-always-chosen -- a set can be *not yet* classified, and
 * `aria-pressed` on a toggle is the honest report of that. A radiogroup would announce
 * "one of these is selected" on every row before anyone has touched it.
 */
function KindChips({
  index,
  value,
  onChange,
}: {
  index: number;
  value: SetKind;
  onChange: (kind: SetKind) => void;
}) {
  return (
    <div role="group" aria-label={SET_LOGGER_LABELS.setTypeGroupAriaLabel} style={{ display: "flex", gap: "4px" }}>
      {SET_KINDS.map((kind) => {
        const KindIcon = KIND_ICON[kind];
        const selected = value === kind;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={selected}
            aria-label={SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS[kind], index + 1)}
            onClick={() => onChange(kind)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              minHeight: "26px",
              padding: "0 8px",
              borderRadius: RADIUS.pill,
              border: `1px solid ${selected ? ACCENT.base : GLASS.border}`,
              background: selected ? ACCENT.base : "transparent",
              color: selected ? TEXT.onAccent : TEXT.tertiary,
              fontSize: TYPE.label.size,
              fontWeight: 600,
              letterSpacing: TYPE.label.tracking,
              cursor: "pointer",
            }}
          >
            <KindIcon size={11} aria-hidden="true" />
            {SET_TYPE_LABELS[kind]}
          </button>
        );
      })}
    </div>
  );
}

/** A numeric cell: no border, mono figures, the background doing the separating. */
function NumberCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <CellLabel>{label}</CellLabel>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minHeight: MOTION.minTouchTarget,
          padding: "8px 12px",
          // No border, on purpose. Four outlined boxes per set turn the table into a
          // stack of cards on a narrow screen, and the ring from `stateRules()` already
          // covers the one case that needs a visible edge: the cell being edited.
          border: "1px solid transparent",
          borderRadius: RADIUS.input,
          background: SURFACE.elevated,
          color: TEXT.primary,
          fontFamily: TYPE.mono.font,
          fontSize: TYPE.mono.size,
          fontWeight: TYPE.mono.weight,
          fontVariantNumeric: NUMERIC.align,
        }}
      />
    </label>
  );
}

function GhostIcon({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "32px",
        minHeight: "32px",
        borderRadius: RADIUS.sm,
        border: `1px solid ${GLASS.border}`,
        background: "transparent",
        color: TEXT.tertiary,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CellLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        marginBottom: "4px",
        fontSize: TYPE.label.size,
        fontWeight: TYPE.label.weight,
        letterSpacing: TYPE.label.tracking,
        color: TEXT.tertiary,
      }}
    >
      {children}
    </span>
  );
}

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.xs,
  flexWrap: "wrap",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr)",
  gap: SPACE.sm,
};

const setNumberStyle: CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.caption.size,
  fontWeight: 600,
  letterSpacing: TYPE.label.tracking,
};

const monoStyle: CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.mono.size,
  fontWeight: TYPE.mono.weight,
  fontVariantNumeric: NUMERIC.align,
};

const headingStyle: CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.disabled,
};

/** Rendered above the opening set, so the delta is read as advice rather than as a result. */
const suggestionStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  color: TEXT.secondary,
};
