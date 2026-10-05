/**
 * PreWorkoutSummary.tsx — what this session is about to do, and the button that starts it.
 *
 * The screen exists to answer two questions before the first set: *what am I about to
 * train*, and *is it worth starting now*. So it is one figure, one list, one button, and
 * nothing else -- no per-exercise detail, because a lifter standing at the rack with a
 * plan open does not need to be walked through it.
 *
 * Why the muscle map rather than a list
 * -------------------------------------
 * A list of "Pecho x4, Espalda x3, Cuádriceps x4" is the same information in a form that
 * needs reading and a mental sum. The figure answers "is this session lopsided?" in one
 * glance, which is the question a plan raises -- a routine with four chest exercises and
 * one calf exercise looks lopsided *as a shape*, and that is the moment the athlete can
 * still change it.
 *
 * The distribution is computed from the same `countMuscleSets` the figure is lit from, so
 * the numbers under the image and the shading on it cannot disagree. That is the whole
 * reason that function is exported rather than inlined in the logger: two counts, one
 * definition, and a summary that disagrees with the picture beside it would look
 * authoritative in both places.
 *
 * The button
 * ----------
 * Red, and the only red on the screen. `ACCENT.base` filled, with `TEXT.onAccent` ink
 * rather than white -- the accent is bright enough that white on it fails contrast, which
 * `tokens.test.ts` asserts. It is the full width of the column because there is exactly
 * one thing to do here and making it small would imply there were others.
 */

import { Play } from "lucide-react";
import { MuscleReadonlyMap, countMuscleSets } from "../MuscleReadonlyMap";
import type { Slug } from "react-muscle-highlighter";
import type { PlannedExercise } from "../../hooks/useGymData";
import { muscleDefinition } from "../../lib/muscleMap";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  TEXT,
  TYPE,
} from "../../design/tokens";

export interface PreWorkoutSummaryProps {
  routineTitle: string;
  planned: readonly PlannedExercise[];
  onStart: () => void;
}

export function PreWorkoutSummary({
  routineTitle,
  planned,
  onStart,
}: PreWorkoutSummaryProps) {
  const counts = countMuscleSets(
    planned.map((p) => ({
      exercise: p.exercise,
      target_sets: p.target_sets,
    })),
  );

  const totalSets = planned.reduce((n, p) => n + p.target_sets, 0);
  const exerciseCount = planned.length;

  return (
    <section
      aria-label={`Resumen de ${routineTitle}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SPACE.lg,
        maxWidth: "520px",
        margin: "0 auto",
      }}
    >
      <header style={{ textAlign: "center" }}>
        <h1
          style={{
            margin: 0,
            fontSize: TYPE.title1.size,
            lineHeight: TYPE.title1.lineHeight,
            fontWeight: TYPE.title1.weight,
            letterSpacing: TYPE.title1.tracking,
            color: TEXT.primary,
          }}
        >
          {routineTitle}
        </h1>
        <p
          style={{
            margin: `${SPACE.xs} 0 0`,
            fontSize: TYPE.caption.size,
            color: TEXT.tertiary,
          }}
        >
          {exerciseCount} {exerciseCount === 1 ? "ejercicio" : "ejercicios"} · {totalSets}{" "}
          {totalSets === 1 ? "serie" : "series"}
        </p>
      </header>

      {/*
        The figure and the list are one unit: the map says which regions, the list says
        how much. Without the list the tint has no key; without the map the list is a sum
        the athlete has to do in their head.
      */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: SPACE.md,
          width: "100%",
          padding: SPACE.card,
          borderRadius: RADIUS.card,
          background: GLASS.fill,
          border: `1px solid ${GLASS.border}`,
          boxShadow: GLASS.shadow,
        }}
      >
        <MuscleReadonlyMap counts={counts} label={`Distribución muscular de ${routineTitle}`} />
        <MuscleCounts counts={counts} />
      </div>

      <button
        type="button"
        onClick={onStart}
        className="gbtn"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.sm,
          width: "100%",
          minHeight: 56,
          borderRadius: RADIUS.button,
          border: `1px solid ${ACCENT.base}`,
          /*
           * The token's value, not `var(--cronos-accent-base)`.
           *
           * `cssVars()` projects the palette into custom properties but nothing injects
           * them into the document -- see the note on `stateRules()`. A `var()` here would
           * resolve to nothing and the button would arrive with no fill at all, which is
           * the failure the token file predicts for exactly this mistake. The value is
           * written because the token is the definition, not because the variable exists.
           */
          background: ACCENT.base,
          color: TEXT.onAccent,
          fontSize: TYPE.headline.size,
          fontWeight: 700,
          cursor: "pointer",
          transition: `filter ${MOTION.fast} ${MOTION.standard}`,
        }}
      >
        <Play size={18} aria-hidden="true" />
        Empezar
      </button>
    </section>
  );
}

/**
 * The distribution as text.
 *
 * Every muscle with sets, biggest first, with its share. Two reasons it is a real list
 * and not just an `aria-label`: the tint on the figure has three steps and no legend, so
 * without this the shading is decorative; and "Pecho 47%" is the thing an athlete would
 * say out loud to a training partner.
 *
 * Cut at six. Past that it is a wall, and on a phone the wall pushes the start button
 * below the fold -- which is the one control on this screen that must always be visible.
 */
function MuscleCounts({ counts }: { counts: ReadonlyMap<Slug, number> }) {
  const rows = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) return null;

  const total = rows.reduce((n, [, count]) => n + count, 0);
  const shown = rows.slice(0, 6);
  const rest = rows.length - shown.length;

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        width: "100%",
      }}
    >
      {shown.map(([slug, count]) => (
        <li
          key={slug}
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE.sm,
            fontSize: TYPE.caption.size,
            color: TEXT.secondary,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, color: TEXT.primary }}>
            {muscleDefinition(slug)?.label ?? slug}
          </span>
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: "tabular-nums",
              color: TEXT.tertiary,
            }}
          >
            {count} {count === 1 ? "serie" : "series"}
          </span>
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: "tabular-nums",
              color: TEXT.tertiary,
              minWidth: "4ch",
              textAlign: "right",
            }}
          >
            {Math.round((count / total) * 100)}%
          </span>
        </li>
      ))}
      {rest > 0 && (
        <li style={{ fontSize: TYPE.caption.size, color: TEXT.disabled }}>
          y {rest} {rest === 1 ? "músculo más" : "músculos más"}
        </li>
      )}
    </ul>
  );
}
