/**
 * WeightStepper.tsx — the weight control for a single set.
 *
 * A bare number input would be wrong here, and the reason is the whole point of
 * this component: the number has to be a weight the gym can actually load. Every
 * value it reports, every step it takes and every plate it prints comes from
 * `weightUtils`, against the rack described by `GymSettingsContext` -- which by
 * default is this gym's official scale, 2.5, 5, 10, 15 and 20 kg. That is why this
 * component holds no plate arithmetic of its own.
 *
 * The editable field keeps a *draft* string while it has focus and commits on
 * blur or Enter, the same reasoning as `SetEntry.weight`: rounding a half-typed
 * `"8"` on every keystroke is how a weight field ends up resetting itself
 * mid-entry. Snapping happens once, at the commit.
 */

import { useCallback, useId, useMemo, useState, type CSSProperties } from "react";
import { Minus, Plus, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import { STEPPER_LABELS, WEIGHT_UNIT_LABELS } from "@/lib/i18n";
import { kgToLb, lbToKg } from "@/lib/profile";
import { useGymSettings } from "@/context/GymSettingsContext";
import {
  BAR_WEIGHTS,
  calculatePlates,
  nearestLoadable,
  warmupSets,
  type BarType,
  type PlateInventory,
  type PlateKg,
} from "@/lib/workout/weightUtils";
import { ACCENT, GLASS, MOTION, NUMERIC, RADIUS, SOLID, SPACE, STATUS, SURFACE_ROLE, TEXT, TYPE } from "@/design/tokens";

export interface WeightStepperProps {
  /** Current weight in **kg**, whatever unit the user reads. */
  value: number;
  onChange: (kg: number) => void;
  /** A target the engine suggests. Shown as a chip the user can apply. */
  suggestedKg?: number;
  /** Last session's working set, for the "same as last time" reference. */
  previousKg?: number;
  previousReps?: number;
  /**
   * Makes the previous-session reference a one-tap autofill.
   *
   * Omit it and the reference renders as a plain caption instead of a button, so
   * a caller that cannot apply it never gets a control that does nothing.
   * The weight is snapped to the rack here, not at the call site, because this
   * component is the one that knows what the plates can build.
   */
  onApplyPrevious?: (kg: number, reps: number | null) => void;
  /** Overrides the rack's configured bar. */
  barType?: BarType;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Why the suggestion exists, shown next to it. */
  suggestionReason?: string;
  /**
   * Replaces what tapping the suggestion chip does.
   *
   * The default is "set the weight to this", which is right for a standalone
   * stepper. The set logger needs more: applying an overload target also means
   * taking its rep count, and the weight alone would leave the row claiming one
   * thing and training another.
   */
  onApplySuggestion?: (kg: number) => void;
}

/** Plate sizes, smallest first, for scanning the inventory. */
const PLATE_SIZES: readonly PlateKg[] = [0.5, 1.25, 2.5, 5, 10, 15, 20, 25];

/** Step used when the rack has no plates at all, so the buttons still move. */
const FALLBACK_STEP_KG = 2.5;

const MAX_INPUT_KG = 999;

/**
 * The smallest plate in the rack, or null when there are none.
 *
 * The step is **twice** the smallest plate, because plates are counted per side:
 * adding a 2.5 to each end moves the bar 5 kg, and a stepper that moved it 2.5
 * would spend half its presses landing on a weight that does not exist.
 */
export function smallestPlate(inventory: PlateInventory): PlateKg | null {
  for (const size of PLATE_SIZES) {
    if ((inventory[size] ?? 0) > 0) return size;
  }
  return null;
}

/** One decimal at most: a weight is never finer than a plate. */
function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function WeightStepper({
  value,
  onChange,
  suggestedKg,
  previousKg,
  previousReps,
  onApplyPrevious,
  barType: barTypeProp,
  min = 0,
  max = MAX_INPUT_KG,
  disabled = false,
  suggestionReason,
  onApplySuggestion,
}: WeightStepperProps) {
  const settings = useGymSettings();
  const fieldId = useId();

  const barType = barTypeProp ?? settings.barType;
  const barKg = barType === "custom" ? settings.customBarKg : BAR_WEIGHTS[barType];
  const inventory = settings.inventory;
  const unit = WEIGHT_UNIT_LABELS[settings.weightUnit];

  /** The stepper speaks the user's unit; `value` and `onChange` speak kg. */
  const toDisplay = (kg: number): number =>
    settings.weightUnit === "lb" ? kgToLb(kg) : kg;
  const fromDisplay = (shown: number): number =>
    settings.weightUnit === "lb" ? lbToKg(shown) : shown;

  const clamp = useCallback(
    (kg: number) => Math.min(max, Math.max(min, kg)),
    [min, max],
  );

  const shownValue = toDisplay(value);
  // Null means "not being edited", which is different from "being edited as empty".
  const [draft, setDraft] = useState<string | null>(null);

  const stepKg = useMemo(() => {
    const smallest = smallestPlate(inventory);
    return smallest === null ? FALLBACK_STEP_KG : smallest * 2;
  }, [inventory]);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (disabled) return;
      // `nearestLoadable` rather than a plain addition: at the top of the rack's
      // range the next multiple of the step may not exist, and the press should
      // land on the closest weight that does rather than do nothing.
      const next = clamp(nearestLoadable(value + direction * stepKg, barKg, inventory));
      if (next !== value) onChange(next);
    },
    [disabled, value, stepKg, barKg, inventory, clamp, onChange],
  );

  const commit = useCallback(
    (raw: string) => {
      setDraft(null);
      // Accept a decimal comma: this is a Spanish UI and the soft keyboard on iOS
      // offers it by default in es-ES locales.
      const parsed = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(parsed)) return;
      const next = clamp(nearestLoadable(fromDisplay(parsed), barKg, inventory));
      if (next !== value) onChange(next);
    },
    [fromDisplay, barKg, inventory, clamp, value, onChange],
  );

  const plates = useMemo(
    () => calculatePlates(value, barKg, inventory),
    [value, barKg, inventory],
  );

  // A ramp below the bar is not a ramp, it is the same bar three times.
  const warmups = useMemo(
    () => (value > barKg ? warmupSets(value, barKg, inventory) : []),
    [value, barKg, inventory],
  );

  const atMin = disabled || value <= min;
  const atMax = disabled || value >= max;
  const hasSuggestion =
    suggestedKg !== undefined && suggestedKg > 0 && suggestedKg !== value;

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: SPACE.sm,
    padding: "12px",
    borderRadius: RADIUS.control,
    background: GLASS.fill,
    border: `1px solid ${SOLID.border}`,
  };

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const chipStyle = (accent: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    padding: "2px 10px",
    borderRadius: RADIUS.pill,
    fontSize: TYPE.label.size,
    fontWeight: 600,
    letterSpacing: TYPE.label.tracking,
    fontVariantNumeric: NUMERIC.align,
    color: accent ? ACCENT.text : TEXT.secondary,
    background: accent ? ACCENT.muted : SURFACE_ROLE.well,
    border: `1px solid ${accent ? ACCENT.border : GLASS.border}`,
  });

  const buttonStyle = (enabled: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // WCAG 2.5.5: the tap target does not shrink because the control looks small.
    minWidth: MOTION.minTouchTarget,
    minHeight: MOTION.minTouchTarget,
    borderRadius: RADIUS.control,
    border: `1px solid ${GLASS.borderStrong}`,
    background: GLASS.fillRaised,
    color: enabled ? TEXT.primary : TEXT.disabled,
    cursor: enabled ? "pointer" : "not-allowed",
  });

  return (
    <div style={containerStyle} role="group" aria-label={STEPPER_LABELS.groupAriaLabel}>
      <div style={rowStyle}>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={atMin}
          aria-label={STEPPER_LABELS.decreaseAriaLabel}
          style={buttonStyle(!atMin)}
        >
          <Minus size={18} aria-hidden="true" />
        </button>

        <label htmlFor={fieldId} style={{ position: "absolute", left: "-9999px" }}>
          {STEPPER_LABELS.inputAriaLabel(trim(shownValue), unit)}
        </label>
        <input
          id={fieldId}
          // `text`, not `number`, and the reason is the decimal comma. A number
          // input sanitises anything that is not a valid floating-point literal,
          // so a Spanish soft keyboard's "," leaves the field *empty* rather than
          // being committed -- the value never even reaches `commit`. `inputMode`
          // still puts the numeric keypad on the phone, and `role`/`aria-value*`
          // below hand assistive tech the spinbutton semantics a number input
          // would have given for free.
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-valuenow={shownValue}
          aria-valuemin={min}
          aria-valuemax={max}
          disabled={disabled}
          value={draft ?? String(shownValue)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
              return;
            }
            // A `number` input would step on ArrowUp/ArrowDown for free; this one
            // has to ask, so the keyboard and the +/- pair cannot disagree.
            if (event.key === "ArrowUp") {
              event.preventDefault();
              step(1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              step(-1);
            }
          }}
          aria-label={STEPPER_LABELS.inputAriaLabel(trim(shownValue), unit)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: MOTION.minTouchTarget,
            padding: "8px 12px",
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.borderStrong}`,
            background: SURFACE_ROLE.well,
            color: TEXT.primary,
            fontSize: TYPE.title.size,
            fontWeight: TYPE.title.weight,
            textAlign: "center",
            fontVariantNumeric: NUMERIC.align,
          }}
        />

        <button
          type="button"
          onClick={() => step(1)}
          disabled={atMax}
          aria-label={STEPPER_LABELS.increaseAriaLabel}
          style={buttonStyle(!atMax)}
        >
          <Plus size={18} aria-hidden="true" />
        </button>

        <span
          aria-hidden="true"
          style={{
            fontSize: TYPE.body.size,
            color: TEXT.tertiary,
            fontVariantNumeric: NUMERIC.align,
          }}
        >
          {unit}
        </span>
      </div>

      {previousKg !== undefined && (
        <div style={rowStyle}>
          {onApplyPrevious ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onApplyPrevious(
                  clamp(nearestLoadable(previousKg, barKg, inventory)),
                  previousReps ?? null,
                )
              }
              aria-label={
                previousReps === undefined
                  ? STEPPER_LABELS.applyPreviousAriaLabelWithoutReps(trim(toDisplay(previousKg)))
                  : STEPPER_LABELS.applyPreviousAriaLabel(
                      trim(toDisplay(previousKg)),
                      String(previousReps),
                    )
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                minHeight: "28px",
                padding: "2px 10px",
                borderRadius: RADIUS.pill,
                border: `1px solid ${GLASS.border}`,
                background: SURFACE_ROLE.well,
                color: TEXT.secondary,
                fontSize: TYPE.label.size,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <RotateCcw size={12} aria-hidden="true" />
              {STEPPER_LABELS.previousSet(
                trim(toDisplay(previousKg)),
                String(previousReps ?? "—"),
              )}
            </button>
          ) : (
            <span style={{ fontSize: TYPE.body.size, color: TEXT.tertiary }}>
              {STEPPER_LABELS.previousSet(
                trim(toDisplay(previousKg)),
                String(previousReps ?? "—"),
              )}
            </span>
          )}
        </div>
      )}

      <p style={{ margin: 0, fontSize: TYPE.label.size, color: TEXT.tertiary }}>
        {STEPPER_LABELS.platesLabel}:{" "}
        {plates.platesPerSide.length === 0 ? (
          <span style={{ color: TEXT.secondary }}>{STEPPER_LABELS.emptyBarPlates}</span>
        ) : (
          plates.platesPerSide.map((plate) => (
            <span key={plate.weight} style={{ marginRight: "6px", color: TEXT.secondary }}>
              {plate.count} × {trim(plate.weight)}
            </span>
          ))
        )}
      </p>

      {!plates.isExact && (
        <p style={{ margin: 0, fontSize: TYPE.label.size, color: STATUS.warning.text }}>
          {STEPPER_LABELS.shortfall(trim(toDisplay(Math.abs(plates.remainder))), unit)}
        </p>
      )}

      {hasSuggestion && suggestedKg !== undefined && (
        <div style={rowStyle}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => (onApplySuggestion ?? ((kg) => onChange(clamp(kg))))(suggestedKg)}
            aria-label={STEPPER_LABELS.applySuggestionAriaLabel(trim(toDisplay(suggestedKg)), unit)}
            style={{
              ...chipStyle(true),
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Sparkles size={12} aria-hidden="true" />
            {STEPPER_LABELS.suggestionLabel} {trim(toDisplay(suggestedKg))} {unit}
          </button>
          {suggestionReason && (
            <span style={{ fontSize: TYPE.label.size, color: TEXT.tertiary }}>
              {suggestionReason}
            </span>
          )}
        </div>
      )}

      {warmups.length > 0 && (
        <div style={rowStyle}>
          <span style={{ fontSize: TYPE.label.size, color: TEXT.tertiary }}>
            {STEPPER_LABELS.warmupLabel}
          </span>
          {warmups.map((warmupKg) => (
            <button
              key={warmupKg}
              type="button"
              disabled={disabled}
              onClick={() => onChange(clamp(warmupKg))}
              aria-label={STEPPER_LABELS.applyWarmupAriaLabel(trim(toDisplay(warmupKg)), unit)}
              style={{
                ...chipStyle(false),
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <TrendingUp size={12} aria-hidden="true" />
              {trim(toDisplay(warmupKg))} {unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
