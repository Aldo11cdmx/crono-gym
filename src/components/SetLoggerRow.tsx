/**
 * SetLoggerRow.tsx — one logged set: kind, load, reps, RPE, completion.
 *
 * Colour comes from `STATUS` in `design/tokens.ts` and from nowhere else. That
 * used to be a table of Tailwind classes -- `text-emerald-300` for a load
 * increase, `text-amber-300` for a deload -- and it drifted: the increase green
 * is the exact hue `tokens.ts` documents as excluded from this product because a
 * deuteranope folds it into the deload amber sitting one card below. The token
 * table already solved that, so this file now reads it instead of re-deciding.
 */

import type { CSSProperties, ReactNode } from "react";
import { Copy, Flag, Flame, Layers, Trash2, TrendingUp, TrendingDown, Undo2 } from "lucide-react";
import {
  SET_LOGGER_LABELS,
  SET_TYPE_LABELS,
} from "../lib/i18n";
import { SET_KINDS, type SetKind } from "../lib/workout/setKind";
import type { OverloadDecision, OverloadTarget } from "../lib/overload";
import type { BarType } from "../lib/workout/weightUtils";
import type { SetEntry } from "../lib/workout/types";
import { WeightStepper } from "./workout/WeightStepper";
import {
  ACCENT,
  DANGER,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SPACE,
  STATUS,
  SURFACE_ROLE,
  TEXT,
  TYPE,
} from "../design/tokens";

export type { SetEntry };

export interface SetLoggerRowProps {
  entry: SetEntry;
  index: number;
  onChange: (entry: SetEntry) => void;
  onRemove: () => void;
  /** Copies this row's weight, reps and RPE into a new row below. */
  onDuplicate: () => void;
  /** Previous session's working set, in kg. Feeds the stepper's reference. */
  previousKg?: number;
  previousReps?: number;
  /** Progressive-overload target, or null when there is nothing to suggest. */
  suggestion?: OverloadTarget | null;
  barType?: BarType;
}

/**
 * The tone a decision lends the row, drawn from the status table.
 *
 * A load increase and a deload both move the weight but mean opposite things, so
 * they must not share a colour -- that is the entire reason `progression` is cyan
 * and not green. `hold` deliberately gets no status at all: "maintain the load" is
 * the absence of news and should look like it.
 */
const DECISION_TONE: Partial<Record<OverloadDecision, (typeof STATUS)[keyof typeof STATUS]>> = {
  increase: STATUS.progression,
  double_progression: STATUS.progression,
  deload: STATUS.warning,
  stalled: STATUS.warning,
  return_from_break: STATUS.comeback,
};

const DECISION_ICON: Partial<Record<OverloadDecision, typeof TrendingUp>> = {
  increase: TrendingUp,
  double_progression: TrendingUp,
  deload: TrendingDown,
  stalled: TrendingDown,
  return_from_break: Undo2,
};

const KIND_ICON: Record<SetKind, typeof Flame> = {
  // A failure set is a good day, not a cold one: an icon that reads as "worse"
  // on the row you worked hardest for is exactly backwards.
  normal: TrendingUp,
  warmup: Flame,
  failure: Flag,
  drop: Layers,
};

export function SetLoggerRow({
  entry,
  index,
  onChange,
  onRemove,
  onDuplicate,
  previousKg,
  previousReps,
  suggestion,
  barType,
}: SetLoggerRowProps) {
  const decision =
    suggestion && suggestion.decision !== "first_time" ? suggestion.decision : null;
  const tone = decision ? DECISION_TONE[decision] : null;
  const Icon = (decision ? DECISION_ICON[decision] : null) ?? TrendingUp;

  const setLabel = SET_LOGGER_LABELS.setNumber(index + 1);

  return (
    <div
      role="group"
      aria-label={SET_LOGGER_LABELS.setNumber(index + 1)}
      style={{
        borderRadius: RADIUS.control,
        borderWidth: "1px",
        borderStyle: "solid",
        padding: "12px",
        background: GLASS.fill,
        borderColor: tone ? tone.border : GLASS.border,
      }}
    >
      <div style={rowStyle}>
        <span
          style={{
            fontSize: TYPE.label.size,
            fontWeight: 600,
            letterSpacing: TYPE.label.tracking,
            color: ACCENT.text,
          }}
        >
          {setLabel}
        </span>

        <div style={{ flex: 1 }} />

        <IconButton
          onClick={onDuplicate}
          ariaLabel={SET_LOGGER_LABELS.duplicateAriaLabel(index + 1)}
          title={SET_LOGGER_LABELS.duplicateAriaLabel(index + 1)}
        >
          <Copy size={14} aria-hidden="true" />
        </IconButton>

        <IconButton
          onClick={onRemove}
          ariaLabel={SET_LOGGER_LABELS.removeAriaLabel(index + 1)}
          title={SET_LOGGER_LABELS.removeAriaLabel(index + 1)}
          color={DANGER.text}
        >
          <Trash2 size={14} aria-hidden="true" />
        </IconButton>
      </div>

      <div
        role="group"
        aria-label={SET_LOGGER_LABELS.setTypeGroupAriaLabel}
        style={{ ...rowStyle, marginTop: SPACE.xs, flexWrap: "wrap" }}
      >
        {SET_KINDS.map((kind) => {
          const KindIcon = KIND_ICON[kind];
          const selected = entry.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={selected}
              aria-label={SET_LOGGER_LABELS.setTypeAriaLabel(SET_TYPE_LABELS[kind], index + 1)}
              onClick={() => onChange({ ...entry, kind })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                minHeight: "28px",
                padding: "2px 10px",
                borderRadius: RADIUS.pill,
                borderWidth: "1px",
                borderStyle: "solid",
                fontSize: TYPE.label.size,
                fontWeight: 600,
                cursor: "pointer",
                color: selected ? TEXT.onAccent : TEXT.secondary,
                background: selected ? ACCENT.base : "transparent",
                borderColor: selected ? ACCENT.base : GLASS.border,
              }}
            >
              <KindIcon size={11} aria-hidden="true" />
              {SET_TYPE_LABELS[kind]}
            </button>
          );
        })}
      </div>

      {suggestion && decision && (
        <div style={{ ...rowStyle, marginTop: SPACE.sm, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: RADIUS.pill,
              fontSize: TYPE.label.size,
              fontWeight: 600,
              color: tone?.text ?? TEXT.secondary,
              background: tone?.muted ?? "transparent",
              border: `1px solid ${tone?.border ?? "transparent"}`,
            }}
          >
            <Icon size={11} aria-hidden="true" />
            {SET_LOGGER_LABELS.deltaChip(suggestion.delta)}
          </span>
          {/* The rationale itself lives inside the stepper, next to the chip that
              applies it. Repeating it here would say the same sentence twice on
              one card. */}
          {!suggestion.estimateConfident && (
            <span style={{ fontSize: TYPE.label.size, color: STATUS.warning.text }}>
              {SET_LOGGER_LABELS.lowConfidence}
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: SPACE.sm }}>
        <WeightStepper
          value={Number.parseFloat(entry.weight) || 0}
          onChange={(kg) => onChange({ ...entry, weight: String(kg) })}
          suggestedKg={suggestion?.weight ?? undefined}
          suggestionReason={suggestion?.reason}
          previousKg={previousKg}
          previousReps={previousReps}
          barType={barType}
          min={0}
          // The reference is a one-tap autofill, not a caption: re-typing the
          // same two numbers for the opening set of every session is the most
          // repeated piece of typing in the whole logger.
          onApplyPrevious={
            previousKg === undefined
              ? undefined
              : (kg, reps) =>
                  onChange({
                    ...entry,
                    weight: String(kg),
                    reps: reps === null ? entry.reps : String(reps),
                  })
          }
          // Applying a target is more than a weight: the engine's rep count comes
          // with it, and leaving the old reps behind would have the row claiming
          // one thing while the lifter trains another.
          onApplySuggestion={
            suggestion
              ? (kg) => onChange({ ...entry, weight: String(kg), reps: String(suggestion.reps) })
              : undefined
          }
        />
      </div>

      <div style={{ ...gridStyle, marginTop: SPACE.sm }}>
        <Field
          label={SET_LOGGER_LABELS.repsLabel}
          value={entry.reps}
          onChange={(v) => onChange({ ...entry, reps: v })}
        />
        <Field
          label={SET_LOGGER_LABELS.rpeLabel}
          value={entry.rpe}
          onChange={(v) => onChange({ ...entry, rpe: v })}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...entry, completed: !entry.completed })}
        aria-label={SET_LOGGER_LABELS.completeAriaLabel(index + 1, entry.completed)}
        aria-pressed={entry.completed}
        style={{
          width: "100%",
          minHeight: MOTION.minTouchTarget,
          marginTop: SPACE.sm,
          borderRadius: RADIUS.control,
          borderWidth: "1px",
          borderStyle: "solid",
          fontSize: TYPE.body.size,
          fontWeight: 600,
          cursor: "pointer",
          color: entry.completed ? STATUS.success.text : TEXT.onAccent,
          background: entry.completed ? STATUS.success.muted : ACCENT.base,
          borderColor: entry.completed ? STATUS.success.border : ACCENT.base,
        }}
      >
        {entry.completed
          ? SET_LOGGER_LABELS.completed
          : SET_LOGGER_LABELS.complete}
      </button>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: SPACE.sm,
};

function IconButton({
  onClick,
  ariaLabel,
  title,
  color,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "32px",
        minHeight: "32px",
        borderRadius: RADIUS.sm,
        border: `1px solid ${GLASS.border}`,
        background: "transparent",
        color: color ?? TEXT.tertiary,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Field({
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
      <span
        style={{
          display: "block",
          marginBottom: "4px",
          fontSize: TYPE.label.size,
          color: TEXT.tertiary,
        }}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minHeight: MOTION.minTouchTarget,
          padding: "8px 12px",
          borderRadius: RADIUS.control,
          border: `1px solid ${GLASS.borderStrong}`,
          background: SURFACE_ROLE.well,
          color: TEXT.primary,
          fontSize: TYPE.body.size,
          fontVariantNumeric: NUMERIC.align,
        }}
      />
    </label>
  );
}
