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
import { Check, Copy, Flame, Flag, Layers, Trash2, TrendingUp } from "lucide-react";
import { SET_LOGGER_LABELS, SET_TYPE_LABELS } from "../../lib/i18n";
import { SET_KINDS, type SetKind } from "../../lib/workout/setKind";
import type { OverloadTarget } from "../../lib/overload";
import type { BarType } from "../../lib/workout/weightUtils";
import type { SetEntry } from "../../lib/workout/types";
import { WeightStepper } from "./WeightStepper";
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
  formatWeight,
  suggestion,
  barType,
  onChange,
  onRemove,
  onDuplicate,
  onAdd,
}: SetTableProps) {
  const reducedMotion = useReducedMotion();

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

              <KindChips
                index={index}
                value={entry.kind}
                onChange={(kind) => onChange(index, { ...entry, kind })}
              />

              <div style={{ flex: 1 }} />

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
              onToggle={() => onChange(index, { ...entry, completed: !entry.completed })}
            />
          </div>
        );
      })}

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
