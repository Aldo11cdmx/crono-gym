/**
 * WorkoutPreStartView.tsx — the pre-workout launch screen: what this session is about
 * to do, and the button that starts it.
 *
 * The screen answers two questions before the first set: *what am I about to train*, and
 * *is it worth starting now*. One figure, one distribution, one list, one button --
 * nothing else.
 *
 * The figure
 * ----------
 * The anatomical map is the one that already lights up in Progress and on the dashboard
 * hero -- `MuscleReadonlyMap`, reading the same `countMuscleSets` the numbers below it
 * are computed from. Reusing it rather than drawing a second one is the whole point: a
 * pre-workout map that shaded the muscles differently from the ranks map would be two
 * answers to "which muscles does this session hit", and the athlete would have no way to
 * tell which one was right.
 *
 * The percentages are the map's key. The tint on the figure has three steps and no
 * legend, so without the list beside it the shading is decoration; with it, "Pecho 57%"
 * is the thing an athlete would say out loud to a training partner.
 *
 * The button
 * ----------
 * Red, and the only red on the screen: `ACCENT.base` with `ACCENT.glow` behind it, and
 * `TEXT.onAccent` ink rather than white -- the accent is bright enough that white on it
 * fails contrast, which `tokens.test.ts` asserts. It is the full width of the column
 * because there is exactly one thing to do here and making it small would imply there
 * were others.
 *
 * The exit is a discrete "Volver" in the top-left corner instead of a second button on
 * the card. Leaving is a real option, but it is not what the athlete came here to do,
 * and a second filled button would say the screen was asking two questions at once.
 */

import { ChevronLeft, Dumbbell, Play } from "lucide-react";
import { MuscleReadonlyMap, countMuscleSets } from "../MuscleReadonlyMap";
import type { Slug } from "react-muscle-highlighter";
import type { PlannedExercise } from "../../hooks/useGymData";
import { muscleDefinition } from "../../lib/muscleMap";
import { estimateMinutes } from "../../lib/routines/routineDraftModel";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { GlassButton, GlassCard } from "@/components/ui";
import { ACCENT, GLASS, RADIUS, SPACE, SURFACE, TEXT, TYPE } from "../../design/tokens";

/**
 * The widest the figure is drawn.
 *
 * The library's body is a 2:3 portrait, so a full-width figure on a phone is three
 * quarters of a screen of grey anatomy. Capped and centred, it reads as the focus of
 * the card instead of as a poster.
 */
const FIGURE_MAX_WIDTH = 200;

/** The column the whole screen lives in. Narrow enough to read on a phone, wide enough for the figure. */
const COLUMN_MAX_WIDTH = 520;

export interface WorkoutPreStartViewProps {
  routineTitle: string;
  planned: readonly PlannedExercise[];
  /** Overrides the estimate. The routine's own duration wins when it has one. */
  estimatedMinutes?: number;
  /** Opens the active workout. */
  onStart: () => void;
  /**
   * Leaves the pre-workout screen.
   *
   * Optional, and the button is not rendered without it: a screen that offers an exit
   * it cannot honour is worse than one that does not offer it.
   */
  onExit?: () => void;
}

export function WorkoutPreStartView({
  routineTitle,
  planned,
  estimatedMinutes,
  onStart,
  onExit,
}: WorkoutPreStartViewProps) {
  const reducedTransparency = useMediaQuery("(prefers-reduced-transparency: reduce)");

  const counts = countMuscleSets(
    planned.map((p) => ({
      exercise: p.exercise,
      target_sets: p.target_sets,
    })),
  );

  const totalSets = planned.reduce((n, p) => n + p.target_sets, 0);
  const exerciseCount = planned.length;
  /*
   * The same heuristic the routine cards and the dashboard use, so the number here
   * cannot disagree with the number the athlete was shown before choosing the routine.
   */
  const minutes =
    estimatedMinutes ??
    estimateMinutes(
      exerciseCount,
      planned.reduce((n, p) => n + (p.rest_seconds ?? 0), 0),
    );

  return (
    <section
      aria-label={`Resumen de ${routineTitle}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.lg,
        width: "100%",
        paddingBottom: SPACE.lg,
      }}
    >
      {onExit && (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <GlassButton
            variant="ghost"
            onClick={onExit}
            icon={<ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />}
          >
            Volver
          </GlassButton>
        </div>
      )}

      <div
        style={{
          width: "100%",
          maxWidth: COLUMN_MAX_WIDTH,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: SPACE.lg,
        }}
      >
        <GlassCard
          reducedTransparency={reducedTransparency}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: SPACE.md,
          }}
        >
          <header style={{ textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: TYPE.title.size,
                lineHeight: TYPE.title.lineHeight,
                fontWeight: TYPE.title.weight,
                letterSpacing: TYPE.title.tracking,
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

          <div style={{ width: "100%", maxWidth: FIGURE_MAX_WIDTH, margin: "0 auto" }}>
            <MuscleReadonlyMap
              counts={counts}
              label={`Distribución muscular de ${routineTitle}`}
            />
          </div>

          <MuscleCounts counts={counts} />

          <ExerciseList planned={planned} />
        </GlassCard>

        <GlassButton
          variant="primary"
          block
          onClick={onStart}
          icon={<Play size={18} strokeWidth={1.5} aria-hidden="true" />}
          style={{
            /*
             * The token's value, not `var(--cronos-accent-base)`.
             *
             * `cssVars()` projects the palette into custom properties but nothing injects
             * them into the document -- see the note on `stateRules()`. A `var()` here would
             * resolve to nothing and the button would arrive with no fill at all.
             *
             * The glow is `ACCENT.glow` under an opaque accent fill, so it reads as a halo
             * around the button rather than as a tint of it: the cast has to sit outside
             * the fill to be seen at all.
             */
            boxShadow: `inset 0 1px 0 ${ACCENT.text}, 0 10px 28px ${ACCENT.glow}`,
          }}
        >
          Iniciar Entrenamiento
        </GlassButton>
      </div>
    </section>
  );
}

/**
 * The distribution as text.
 *
 * Every muscle with sets, biggest first, with its share. Two reasons it is a real list
 * and not just an `aria-label`: the tint on the figure has three steps and no legend, so
 * without this the shading is decorative; and "Pecho 57%" is the thing an athlete would
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
    <>
      <SectionLabel>Reparto muscular</SectionLabel>
      <ul
        aria-label="Reparto muscular"
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
    </>
  );
}

/**
 * The exercises this session is going to run, compactly.
 *
 * Name and set count only. The pre-workout screen answers "what am I about to train",
 * not "how do I do it" -- the set table is one tap away and repeating its contents here
 * would be a second, worse version of it.
 */
function ExerciseList({ planned }: { planned: readonly PlannedExercise[] }) {
  if (planned.length === 0) return null;

  return (
    <>
      <SectionLabel>Ejercicios</SectionLabel>
      <ul
        aria-label="Ejercicios planeados"
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
              <Dumbbell size={16} strokeWidth={1.5} aria-hidden="true" />
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
    </>
  );
}

/**
 * The label that names a block inside the card.
 *
 * A heading, so the card can be navigated by heading and the two blocks are announced
 * as the sections they are. `TYPE.label` rather than a bigger step: it is the smallest
 * step on the scale and the one meant for tracked-out microcopy, so the name of a block
 * never competes with the content it names.
 */
function SectionLabel({ children }: { children: string }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: TYPE.label.size,
        lineHeight: TYPE.label.lineHeight,
        fontWeight: TYPE.label.weight,
        letterSpacing: TYPE.label.tracking,
        color: TEXT.tertiary,
        textTransform: "uppercase",
      }}
    >
      {children}
    </h2>
  );
}
