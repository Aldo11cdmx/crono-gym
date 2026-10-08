/** BiometricsInputs.tsx — weight and height with unit conversion. */

import { useState } from "react";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  SOLID,
  TEXT,
  TYPE,
} from "@/design/tokens";
import {
  parseWeightKg,
  parseHeightCm,
  isValidWeightKg,
  isValidHeightCm,
  BODY_WEIGHT_RANGE_KG,
  HEIGHT_RANGE_CM,
} from "@/lib/profile/validation";
import { kgToLb, lbToKg, cmToIn, inToCm, toDisplayUnits } from "@/lib/profile";
import type { UnitSystem } from "@/lib/profile";

export interface BiometricsInputsProps {
  unitSystem: UnitSystem;
  weightKg: number | null;
  heightCm: number | null;
  onWeightKgChange: (kg: number | null) => void;
  onHeightCmChange: (cm: number | null) => void;
  weightError?: string | null;
  heightError?: string | null;
  disabled?: boolean;
}

export function BiometricsInputs({
  unitSystem,
  weightKg,
  heightCm,
  onWeightKgChange,
  onHeightCmChange,
  weightError,
  heightError,
  disabled,
}: BiometricsInputsProps) {
  const [weightDraft, setWeightDraft] = useState<string>(
    weightKg !== null ? String(unitSystem === "imperial" ? kgToLb(weightKg) : weightKg) : "",
  );
  const [heightDraft, setHeightDraft] = useState<string>(
    heightCm !== null
      ? unitSystem === "imperial"
        ? String(cmToIn(heightCm))
        : String(heightCm)
      : "",
  );

  const imperial = unitSystem === "imperial";
  const weightLabel = imperial ? "lb" : "kg";
  const heightLabel = imperial ? "in" : "cm";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
      <div>
        <label style={{ display: "block", marginBottom: 4, fontSize: TYPE.label.size, color: TEXT.tertiary }}>
          Peso ({weightLabel})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={weightDraft}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            setWeightDraft(raw);
            const parsed = parseWeightKg(raw);
            if (parsed === null) {
              onWeightKgChange(null);
              return;
            }
            onWeightKgChange(imperial ? lbToKg(parsed) : parsed);
          }}
          style={{
            width: "100%",
            minHeight: MOTION.minTouchTarget,
            padding: "8px 12px",
            borderRadius: RADIUS.control,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: weightError ? ACCENT.base : SOLID.borderStrong,
            background: "transparent",
            color: TEXT.primary,
            fontSize: TYPE.body.size,
          }}
        />
        {weightError && (
          <span id="weight-error" style={{ display: "block", marginTop: 4, fontSize: TYPE.caption.size, color: ACCENT.text }}>
            {weightError}
          </span>
        )}
      </div>
      <div>
        <label style={{ display: "block", marginBottom: 4, fontSize: TYPE.label.size, color: TEXT.tertiary }}>
          Altura ({heightLabel})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={heightDraft}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            setHeightDraft(raw);
            const parsed = parseHeightCm(raw);
            if (parsed === null) {
              onHeightCmChange(null);
              return;
            }
            onHeightCmChange(imperial ? inToCm(parsed) : parsed);
          }}
          style={{
            width: "100%",
            minHeight: MOTION.minTouchTarget,
            padding: "8px 12px",
            borderRadius: RADIUS.control,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: heightError ? ACCENT.base : SOLID.borderStrong,
            background: "transparent",
            color: TEXT.primary,
            fontSize: TYPE.body.size,
          }}
        />
        {heightError && (
          <span id="height-error" style={{ display: "block", marginTop: 4, fontSize: TYPE.caption.size, color: ACCENT.text }}>
            {heightError}
          </span>
        )}
      </div>
    </div>
  );
}