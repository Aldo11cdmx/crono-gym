/**
 * GymSettingsPanel.tsx — what this gym actually has.
 *
 * Every one of these answers a question the weight stepper cannot answer for
 * itself, and a wrong answer makes the stepper lie: offer a 62.5 kg set to
 * someone whose smallest plate is 2.5 kg and they only find out standing at the
 * rack. That is why this panel is not buried in a profile page -- it is one tap
 * from the logger.
 *
 * The plate preview is not decoration. It is the only way to answer "do I
 * actually own these plates?" at a glance instead of by reading five counters,
 * and it is drawn from the same `GYM_PLATE_SCALE` the calculator uses, so the
 * picture and the maths cannot disagree.
 */

import { useId, type CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import {
  GYM_PLATE_SCALE,
  useGymSettings,
  type WeightUnit,
} from "@/context/GymSettingsContext";
import { GYM_LABELS } from "@/lib/i18n";
import {
  BAR_WEIGHTS,
  type BarType,
  type PlateKg,
} from "@/lib/workout/weightUtils";
import {
  ACCENT,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SOLID,
  SPACE,
  SURFACE_ROLE,
  TEXT,
  TYPE,
} from "@/design/tokens";

/**
 * How many pairs of a size the panel will count.
 *
 * Four is one full Olympic tree per side with a spare; a gym with eight pairs of
 * 20s is not a thing the stepper needs to distinguish, and an unbounded counter
 * invites typos that look like real inventory.
 */
const MAX_PAIRS = 4;

const BAR_TYPES: readonly BarType[] = ["olympic", "standard", "ez", "hex", "custom"];

const UNITS: readonly WeightUnit[] = ["kg", "lb"];

/** The change plates `useHalfPlates` unlocks, smallest first. */
const CHANGE_PLATES: readonly PlateKg[] = [1.25, 0.5];

/** Relative widths for the preview, so a 20 reads as bigger than a 2.5. */
const PLATE_WIDTH: Record<string, number> = {
  "0.5": 4,
  "1.25": 5,
  "2.5": 7,
  "5": 9,
  "10": 13,
  "15": 16,
  "20": 19,
  "25": 22,
};

export interface GymSettingsPanelProps {
  onClose: () => void;
}

export function GymSettingsPanel({ onClose }: GymSettingsPanelProps) {
  const gym = useGymSettings();
  const { updateSettings } = gym;
  const titleId = useId();

  const plateSizes = gym.useHalfPlates
    ? [...GYM_PLATE_SCALE, ...CHANGE_PLATES]
    : [...GYM_PLATE_SCALE];

  /** Pairs per side for one size, ordered smallest first for the preview. */
  const configured = [...plateSizes]
    .filter((size) => (gym.inventory[size] ?? 0) > 0)
    .sort((a, b) => a - b);

  function setPairs(size: PlateKg, pairs: number) {
    const next = { ...gym.inventory };
    if (pairs <= 0) delete next[size];
    else next[size] = pairs;
    updateSettings({ inventory: next });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.lg,
        maxWidth: "420px",
        maxHeight: "100%",
        overflowY: "auto",
        padding: SPACE.lg,
        borderRadius: RADIUS.card,
        border: `1px solid ${SOLID.borderStrong}`,
        background: SOLID.popover,
        boxShadow: GLASS.shadow,
      }}
    >
      <h2
        id={titleId}
        style={{
          margin: 0,
          fontSize: TYPE.title.size,
          fontWeight: TYPE.title.weight,
          letterSpacing: TYPE.title.tracking,
          color: TEXT.primary,
        }}
      >
        {GYM_LABELS.title}
      </h2>

      {/* ------------------------------------------------------------- bar */}
      <section style={sectionStyle}>
        <SectionLabel>{GYM_LABELS.barLabel}</SectionLabel>
        <div style={chipRowStyle}>
          {BAR_TYPES.map((type) => {
            const selected = gym.barType === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={selected}
                onClick={() => updateSettings({ barType: type })}
                style={chipStyle(selected)}
              >
                {GYM_LABELS.bars[type]}
              </button>
            );
          })}
        </div>

        {gym.barType === "custom" && (
          <label style={{ ...fieldStyle, marginTop: SPACE.sm }}>
            <span style={fieldLabelStyle}>{GYM_LABELS.customBarLabel}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={gym.customBarKg}
              onChange={(event) => {
                const parsed = Number.parseFloat(event.target.value);
                // A typed "-" or "" is NaN. Keep the last valid weight rather
                // than writing NaN into settings, which the stepper would then
                // divide by.
                if (Number.isFinite(parsed) && parsed >= 0) {
                  updateSettings({ customBarKg: parsed });
                }
              }}
              style={inputStyle}
            />
          </label>
        )}

        <p style={hintStyle}>
          {GYM_LABELS.barWeightSummary(
            gym.barType === "custom" ? gym.customBarKg : BAR_WEIGHTS[gym.barType],
          )}
        </p>
      </section>

      {/* ------------------------------------------------------------ unit */}
      <section style={sectionStyle}>
        <SectionLabel>{GYM_LABELS.unitLabel}</SectionLabel>
        <div style={chipRowStyle}>
          {UNITS.map((unit) => {
            const selected = gym.weightUnit === unit;
            return (
              <button
                key={unit}
                type="button"
                aria-pressed={selected}
                onClick={() => updateSettings({ weightUnit: unit })}
                style={chipStyle(selected)}
              >
                {unit}
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- plates */}
      <section style={sectionStyle}>
        <SectionLabel>{GYM_LABELS.platesLabel}</SectionLabel>

        <label style={{ ...fieldStyle, flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <input
            type="checkbox"
            checked={gym.useHalfPlates}
            onChange={(event) => updateSettings({ useHalfPlates: event.target.checked })}
            style={{ width: 20, height: 20, accentColor: ACCENT.base }}
          />
          <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>
            {GYM_LABELS.halfPlatesLabel}
          </span>
        </label>

        {/*
          The unit label is a column header, not a caption above the list.

          "pares por lado" exists to disambiguate a bare digit, and a caption only
          disambiguates the digit it is next to. Every row is its own statement
          -- `2.5 kg ... 2 pares` -- so the label has to sit in the same row as the
          digits, over the column that holds them.
        */}
        <div style={columnHeaderStyle}>
          <span style={{ flex: 1 }}>{GYM_LABELS.plateColumnLabel}</span>
          {/*
            Same three-part structure as the rows below, with the label in the
            middle slot. Reusing the row's own geometry -- rather than an
            absolutely positioned caption -- is what guarantees the label ends up
            over the digits; a caption aligned by eye is aligned until someone
            changes the counter width.
          */}
          <span style={counterStyle} aria-hidden="true">
            <span style={counterGutter} />
            <span style={{ minWidth: 28, textAlign: "center" }}>
              {GYM_LABELS.pairsColumnLabel}
            </span>
            <span style={counterGutter} />
          </span>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {plateSizes.map((size) => (
            <li
              key={size}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: SPACE.sm,
                padding: "6px 0",
                borderBottom: `1px solid ${GLASS.border}`,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.sm,
                  fontSize: TYPE.body.size,
                  color: TEXT.primary,
                  fontVariantNumeric: NUMERIC.align,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: PLATE_WIDTH[String(size)],
                    height: 20,
                    borderRadius: 2,
                    background: ACCENT.base,
                    opacity: (gym.inventory[size] ?? 0) > 0 ? 1 : 0.25,
                  }}
                />
                {size} kg
              </span>
              <span style={counterStyle}>
                <CounterButton
                  onClick={() => setPairs(size, (gym.inventory[size] ?? 0) - 1)}
                  disabled={(gym.inventory[size] ?? 0) <= 0}
                  ariaLabel={GYM_LABELS.removePairAriaLabel(size)}
                >
                  <Minus size={14} aria-hidden="true" />
                </CounterButton>
                {/*
                  The unit rides on the number, not just in the column header:
                  the header is read once, the numbers are read on every change,
                  and `2 pares` cannot be misread as two plates on the bar.
                */}
                <span
                  style={{
                    minWidth: 28,
                    textAlign: "center",
                    fontSize: TYPE.body.size,
                    fontWeight: 600,
                    color: TEXT.primary,
                    fontVariantNumeric: NUMERIC.align,
                  }}
                >
                  {GYM_LABELS.pairsSuffix(gym.inventory[size] ?? 0)}
                </span>
                <CounterButton
                  onClick={() => setPairs(size, (gym.inventory[size] ?? 0) + 1)}
                  disabled={(gym.inventory[size] ?? 0) >= MAX_PAIRS}
                  ariaLabel={GYM_LABELS.addPairAriaLabel(size)}
                >
                  <Plus size={14} aria-hidden="true" />
                </CounterButton>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <BarPreview
        barKg={gym.barType === "custom" ? gym.customBarKg : BAR_WEIGHTS[gym.barType]}
        sizes={configured}
      />

      <button
        type="button"
        onClick={onClose}
        style={{
          minHeight: MOTION.minTouchTarget,
          borderRadius: RADIUS.control,
          border: "1px solid transparent",
          background: ACCENT.base,
          color: TEXT.onAccent,
          fontSize: TYPE.body.size,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {GYM_LABELS.done}
      </button>
    </div>
  );
}

/**
 * A side-on drawing of the bar with the configured plates on it.
 *
 * Drawn from the inventory rather than hardcoded so it cannot drift from the
 * counters above it. Widths are proportional-ish to real diameters rather than
 * exactly so: a true-to-scale 0.5 kg plate is a two-pixel sliver, and the point
 * of the drawing is to answer "what is on the bar", not to be a ruler.
 */
function BarPreview({ barKg, sizes }: { barKg: number; sizes: readonly PlateKg[] }) {
  return (
    <section style={sectionStyle} aria-label={GYM_LABELS.previewLabel}>
      <SectionLabel>{GYM_LABELS.previewLabel}</SectionLabel>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          minHeight: 56,
          padding: SPACE.sm,
          borderRadius: RADIUS.control,
          background: SURFACE_ROLE.well,
          border: `1px solid ${GLASS.border}`,
          overflow: "hidden",
        }}
      >
        {/* The sleeve, then one symmetric pair of plate stacks. */}
        <span
          aria-hidden="true"
          style={{ flex: 1, height: 6, background: SOLID.borderStrong, borderRadius: 3 }}
        />
        {sizes.length === 0 ? (
          <span
            aria-hidden="true"
            style={{
              height: 40,
              width: 6,
              background: SOLID.border,
              borderRadius: 3,
              margin: "0 2px",
            }}
          />
        ) : (
          [0, 1].map((side) => (
            <span key={side} aria-hidden="true" style={{ display: "flex" }}>
              {sizes.map((size) => (
                <span
                  key={size}
                  style={{
                    width: PLATE_WIDTH[String(size)],
                    // Taller for heavier plates, so the stack reads as a load
                    // order rather than a row of identical bars.
                    height: 18 + PLATE_WIDTH[String(size)],
                    margin: "0 1px",
                    borderRadius: 2,
                    background: ACCENT.base,
                  }}
                />
              ))}
            </span>
          ))
        )}
        <span
          aria-hidden="true"
          style={{ flex: 1, height: 6, background: SOLID.borderStrong, borderRadius: 3 }}
        />
      </div>
      <p style={hintStyle}>{GYM_LABELS.previewSummary(barKg, sizes)}</p>
    </section>
  );
}

function CounterButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: MOTION.minTouchTarget,
        height: MOTION.minTouchTarget,
        borderRadius: RADIUS.sm,
        border: `1px solid ${GLASS.border}`,
        background: GLASS.fillRaised,
        color: disabled ? TEXT.disabled : TEXT.primary,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: "0 0 8px",
        fontSize: TYPE.label.size,
        fontWeight: 600,
        letterSpacing: TYPE.label.tracking,
        color: TEXT.tertiary,
        textTransform: "uppercase",
      }}
    >
      {children}
    </h3>
  );
}

const sectionStyle: CSSProperties = { display: "block" };

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: SPACE.xs,
};

const fieldStyle: CSSProperties = { display: "block" };

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: "8px 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.borderStrong}`,
  background: SURFACE_ROLE.well,
  color: TEXT.primary,
  fontSize: TYPE.body.size,
  fontVariantNumeric: NUMERIC.align,
};

const counterStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.xs,
};

/**
 * Width of the counter column, minus the three gaps.
 *
 * Reproduced in the column header so the label sits over the digits it names. The
 * number inside it is variable-width (`2 pares` vs `0 pares`), so the header
 * aligns to the *steppers* and the label is right-aligned against them instead --
 * which is the edge the eye actually reads the unit from.
 */
const counterGutter: CSSProperties = { width: MOTION.minTouchTarget };

const columnHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.sm,
  padding: `${SPACE.md} 0 4px`,
  fontSize: TYPE.label.size,
  fontWeight: 600,
  letterSpacing: TYPE.label.tracking,
  textTransform: "uppercase",
  color: TEXT.tertiary,
};

const hintStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

/** A selected chip is the accent fill; unselected ones are hairlines. */
function chipStyle(selected: boolean): CSSProperties {
  return {
    minHeight: 36,
    padding: "0 14px",
    borderRadius: RADIUS.pill,
    borderWidth: "1px",
    borderStyle: "solid",
    fontSize: TYPE.body.size,
    fontWeight: 600,
    cursor: "pointer",
    color: selected ? TEXT.onAccent : TEXT.secondary,
    background: selected ? ACCENT.base : "transparent",
    borderColor: selected ? ACCENT.base : GLASS.border,
  };
}
