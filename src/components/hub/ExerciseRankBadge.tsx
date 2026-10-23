/**
 * ExerciseRankBadge.tsx — this movement, against the strength standard for it.
 *
 * What this is, and what it deliberately is not
 * ---------------------------------------------
 * The brief called this an "exercise rank badge", and the repo already has ranks: eight
 * tiers from Bronce to Obsidiana, resolved by `scoreToRank` from a 0-100 *muscle* score
 * assembled out of relative strength, volume and frequency. Those tiers are real and this
 * component does not touch them.
 *
 * It could not use them anyway. A muscle score is built by `ranksEngine` from a whole
 * region's training history; one exercise's best 1RM against a bodyweight ratio is a
 * different quantity on a different scale. Feeding `1.5 × bodyweight` into a function whose
 * 64 points means "a muscle you have trained hard for a year" would produce a confident,
 * precisely wrong tier. So this shows the thing it can actually defend: **the percentage of
 * the published standard** for this movement, using the same `STANDARD_RATIOS` table the
 * ranks engine calibrates against, and naming which standard it applied.
 *
 * The athlete can then see "135% del estándar de press de banca", which is a claim with
 * units. "Oro" on the same screen would be a claim without them.
 */

import { useMemo } from "react";
import {
  TARGET_STANDARD,
  standardRatioFor,
  hasCalibratedStandard,
  type ExerciseKey,
  type SexKey,
} from "@/lib/ranks/rankConfig";
import { HUB_RECORDS_LABELS } from "@/lib/i18n";
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import type { CSSProperties } from "react";

/** Spanish names for the standards, so the badge says which one it applied. */
const STANDARD_LABELS: Record<ExerciseKey, string> = {
  squat: "sentadilla",
  deadlift: "peso muerto",
  bench: "press de banca",
  overheadPress: "press militar",
  row: "remo",
  pullup: "dominadas",
  dip: "flexiones",
};

export interface ExerciseRankBadgeProps {
  /** Catalog `target`, the only stable handle the dataset gives on a movement. */
  target: string;
  /** The athlete's best estimated 1RM for this exercise, in kg. Null when never trained. */
  estimateKg: number | null;
  /** Bodyweight in kg. Null when unknown, which suppresses the badge entirely. */
  bodyweightKg: number | null;
  sex: SexKey;
}

export function ExerciseRankBadge({
  target,
  estimateKg,
  bodyweightKg,
  sex,
}: ExerciseRankBadgeProps) {
  const standard = TARGET_STANDARD[target];

  const result = useMemo(() => {
    if (!standard) return null;
    // No bodyweight, no ratio: a percentage of an unknown denominator is not a weaker
    // claim, it is not a claim. The panel says "no standard" instead of inventing one.
    if (bodyweightKg === null || bodyweightKg <= 0) return null;
    if (estimateKg === null || estimateKg <= 0) return null;

    const ratio = standardRatioFor(standard, sex);
    const expected = bodyweightKg * ratio;
    return {
      standard,
      percent: Math.round((estimateKg / expected) * 100),
      calibrated: hasCalibratedStandard(sex),
    };
  }, [standard, bodyweightKg, estimateKg, sex]);

  if (!result) {
    return <p style={noneStyle}>{HUB_RECORDS_LABELS.noStandard}</p>;
  }

  return (
    <div
      style={badge}
      aria-label={HUB_RECORDS_LABELS.standardAriaLabel(
        `${result.percent}%`,
        STANDARD_LABELS[result.standard],
      )}
    >
      <span style={percentStyle}>{result.percent}%</span>
      <span style={captionStyle}>del estándar de {STANDARD_LABELS[result.standard]}</span>
      {!result.calibrated ? (
        <span style={caveatStyle}>
          Calculado con la tabla intermedia: tu perfil no declara sexo, así que el
          estándar es el más generoso y el menos calibrado.
        </span>
      ) : null}
    </div>
  );
}

const badge: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: `${SPACE.sm} ${SPACE.md}`,
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

const percentStyle: CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.title2.size,
  fontWeight: TYPE.mono.weight,
  color: TEXT.primary,
  lineHeight: 1.1,
};

const captionStyle: CSSProperties = {
  fontSize: TYPE.caption.size,
  color: TEXT.tertiary,
};

const caveatStyle: CSSProperties = {
  fontSize: TYPE.label.size,
  lineHeight: TYPE.caption.lineHeight,
  color: TEXT.disabled,
};

const noneStyle: CSSProperties = {
  margin: 0,
  padding: SPACE.md,
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  fontSize: TYPE.caption.size,
  color: TEXT.tertiary,
};