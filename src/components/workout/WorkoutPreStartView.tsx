/**
 * WorkoutPreStartView.tsx — what this session is about to do, and the button that starts it.
 *
 * The pre-start screen answers two questions before the first set: *what am I about to
 * train*, and *how long will it take*. One header, one muscle-distribution carousel, one
 * exercise list, one button -- nothing else.
 *
 * The distribution is computed from `countMuscleSets`, the same function the readiness
 * figure is lit from, so the numbers under the cards and the shading on the map cannot
 * disagree.
 *
 * The bottom bar is fixed: "▶ Empezar Entrenamiento" is the only thing on this screen
 * that must always be visible, and it starts the session clock via `ActiveSessionContext`.
 */

import { useCallback } from "react";
import { Play, Dumbbell } from "lucide-react";
import { MuscleReadonlyMap, countMuscleSets } from "../MuscleReadonlyMap";
import type { Slug } from "react-muscle-highlighter";
import type { PlannedExercise } from "../../hooks/useGymData";
import { muscleDefinition } from "../../lib/muscleMap";
import { useActiveSession } from "../../context/ActiveSessionContext";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  TEXT,
  TYPE,
  SURFACE,
} from "../../design/tokens";

export interface WorkoutPreStartViewProps {
  routineTitle: string;
  planned: readonly PlannedExercise[];
  estimatedMinutes?: number;
  onStart?: () => void;
}

export function WorkoutPreStartView({
  routineTitle,
  planned,
  estimatedMinutes,
  onStart,
}: WorkoutPreStartViewProps) {
  const { start } = useActiveSession();
  const counts = countMuscleSets(
    planned.map((p) => ({
      exercise: p.exercise,
      target_sets: p.target_sets,
    })),
  );

  const totalSets = planned.reduce((n, p) => n + p.target_sets, 0);
  const exerciseCount = planned.length;
  const minutes = estimatedMinutes ?? Math.ceil(totalSets * 2.5);

  const handleStart = useCallback(() => {
    start({ id: "", title: routineTitle });
    onStart?.();
  }, [start, routineTitle, onStart]);

  return (
    <section
      aria-label={`Resumen de ${routineTitle}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.lg,
        maxWidth: "520px",
        margin: "0 auto",
        paddingBottom: SPACE.lg,
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
          {totalSets === 1 ? "serie" : "series"} · {minutes} min
        </p>
      </header>

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
        <MuscleReadonlyMap
          counts={counts}
          label={`Distribución muscular de ${routineTitle}`}
        />
        <MuscleCounts counts={counts} />
      </div>

      <ExerciseList planned={planned} />

      <button
        type="button"
        onClick={handleStart}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.sm,
          width: "100%",
          minHeight: 56,
          borderRadius: RADIUS.button,
          border: `1px solid ${ACCENT.base}`,
          background: ACCENT.base,
          color: TEXT.onAccent,
          fontSize: TYPE.headline.size,
          fontWeight: 700,
          cursor: "pointer",
          transition: `filter ${MOTION.fast} ${MOTION.standard}`,
          position: "sticky",
          bottom: SPACE.md,
        }}
      >
        <Play size={18} aria-hidden="true" />
        Empezar Entrenamiento
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

function ExerciseList({ planned }: { planned: readonly PlannedExercise[] }) {
  if (planned.length === 0) return null;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        width: "100%",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: TYPE.subhead.size,
          fontWeight: TYPE.subhead.weight,
          color: TEXT.primary,
          alignSelf: "flex-start",
        }}
      >
        Ejercicios
      </h3>
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
        {planned.map((exercise) => (
          <li
            key={exercise.exercise.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.sm,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: SURFACE.base,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Dumbbell size={16} aria-hidden="true" />
            </div>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: TYPE.body.size,
                color: TEXT.primary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {exercise.exercise.name}
            </span>
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontVariantNumeric: "tabular-nums",
                fontSize: TYPE.caption.size,
                color: TEXT.tertiary,
                minWidth: "4ch",
                textAlign: "right",
              }}
            >
              {exercise.target_sets} {exercise.target_sets === 1 ? "serie" : "series"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
