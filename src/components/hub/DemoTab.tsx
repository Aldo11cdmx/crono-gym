/**
 * DemoTab.tsx — what this movement looks like, what it works, and how to warm up to it.
 *
 * Three things, in that order, because that is the order an athlete standing at the rack
 * asks them: *is this the exercise I think it is*, *what does it actually train*, and *what
 * do I load first*.
 *
 * The warm-up ramp is the reason this tab exists
 * ----------------------------------------------
 * `warmupSets()` has been in the codebase since before this screen, and nothing called it.
 * The math is right -- 40/60/80%, each step snapped to something the gym's own plates can
 * build, none below the empty bar -- but a calculation nobody can reach is not a feature,
 * and the manual alternative is three "add set" taps and three weight edits before the
 * athlete has done a single rep.
 *
 * Where the inserted sets actually land
 * -------------------------------------
 * The session's set array lives in `ActiveWorkout`, on a *different route*, and moving it
 * into shared state would mean the autosave effect, the undo window, the recovery path and
 * the sync payload all had to be re-plumbed. So the hub does not write to the workout; it
 * *asks* for the sets to be added, and `ActiveWorkout` does it through its own mutation
 * path. See `enqueueWarmup` in `ActiveSessionContext`. That is what keeps
 * `finish()`'s `is_warmup` column honest, and why the flag is set here rather than in the
 * hub: there is one place that knows how a set becomes a row.
 */

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Flame, Sparkles } from "lucide-react";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useGymSettings } from "@/context/GymSettingsContext";
import { warmupSets, WARMUP_RAMP } from "@/lib/workout/weightUtils";
import { type SessionMetrics } from "@/lib/exercise/exerciseMetrics";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";
import { MuscleReadonlyMap, countMuscleSets } from "@/components/MuscleReadonlyMap";
import { TechniqueTips } from "@/components/hub/TechniqueTips";
import { MUSCLE_DEFINITIONS, muscleDefinition } from "@/lib/muscleMap";
import { BODY_PART_LABELS, EQUIPMENT_LABELS, HUB_DEMO_LABELS } from "@/lib/i18n";
import { DIAGRAM, GLASS, MOTION, RADIUS, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";
import type { Slug } from "react-muscle-highlighter";
import type { Exercise } from "@/types/supabase";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

export interface DemoTabProps {
  exercise: Exercise;
  /** Newest-first. Used to suggest a working weight and to light the muscle map. */
  sessions: readonly ExerciseSession[];
  metrics: readonly SessionMetrics[];
  loading: boolean;
  error: string | null;
  /** Formats a kg value into the unit this user reads. Supplied, so the rule stays in one place. */
  formatWeight: (kg: number) => string;
}

export function DemoTab({
  exercise,
  sessions,
  metrics,
  loading,
  error,
  formatWeight,
}: DemoTabProps) {
  /*
   * The working weight the ramp is built on.
   *
   * The best estimate this athlete has actually hit, not the target they are aiming at.
   * Warming up on a load they have never touched adds a fourth unfamiliar weight to the
   * session, which is the opposite of what a ramp is for.
   */
  const workingKg = useMemo(() => {
    const estimates = metrics
      .map((m) => m.bestEstimateKg)
      .filter((kg): kg is number => kg !== null && kg > 0);
    return estimates.length > 0 ? Math.max(...estimates) : null;
  }, [metrics]);

  return (
    <div style={column}>
      <Media exercise={exercise} />

      <MusclePanel exercise={exercise} sessions={sessions} loading={loading} error={error} />

      <TechniqueTips exercise={exercise} />

      <WarmupPanel
        exerciseName={exercise.name}
        workingKg={workingKg}
        formatWeight={formatWeight}
      />
    </div>
  );
}

/**
 * The demo, or a placeholder shaped like one.
 *
 * The same 16:9 frame and the same missing-`gif_url` tolerance as `ExerciseStage`, because
 * it is the same question asked on a different screen: most of the catalog has no demo, and
 * an unreserved space would shove everything below it down the page.
 */
function Media({ exercise }: { exercise: Exercise }) {
  const gif = typeof exercise.gif_url === "string" ? exercise.gif_url.trim() : "";
  const media = resolveMedia("exercise-gif", exercise.id, gif);
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const name = getExerciseDisplayName(exercise);

  return (
    <div style={mediaFrame}>
      {gif === "" || failed ? (
        <div style={placeholder}>
          <span>{`Sin demostración para ${name}`}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={`Demostración de ${name}`}
          loading="eager"
          decoding="async"
          width={640}
          height={360}
          onLoad={onLoad}
          onError={onError}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
    </div>
  );
}

/**
 * Which muscles this movement trains, as a figure plus a list.
 *
 * The figure counts *sets actually done*, from the history, rather than assuming the target
 * once. An exercise the athlete has never trained lights nothing, which is the honest
 * answer: the panel is showing what they have trained, not what the movement could train.
 *
 * `countMuscleSets` is the same call `WorkoutPreStartView` makes, deliberately. Two counts
 * on the same screen is how a summary and a figure end up disagreeing while both look
 * authoritative.
 */
function MusclePanel({
  exercise,
  sessions,
  loading,
  error,
}: Pick<DemoTabProps, "exercise" | "sessions" | "loading" | "error">) {
  const counts = useMemo(
    () =>
      countMuscleSets(
        sessions.map((session) => ({
          // The history carries set records, not a catalog row, so the exercise's own
          // target and body part are supplied per session. `countMuscleSets` only reads
          // those two strings.
          exercise: { target: exercise.target, body_part: exercise.body_part },
          target_sets: session.sets.length,
        })),
      ),
    [sessions, exercise.target, exercise.body_part],
  );

  /*
   * Primary and secondary, read from the catalog's own two columns.
   *
   * `target` is what the movement is for; `body_part` is the region it is filed under. The
   * second is usually a subset of the first, so the list prints a primary and shows
   * secondary only when it adds something -- otherwise "Principales: Pecho / Secundarias:
   * Pecho" is a heading arguing with itself.
   */
  const { primary, secondary } = useMemo(() => {
    const primarySlug = slugForTarget(exercise.target);
    const secondarySlug = slugForBodyPart(exercise.body_part);
    return {
      primary: primarySlug ? muscleLabel(primarySlug, exercise.target) : exercise.target,
      secondary:
        secondarySlug && secondarySlug !== primarySlug
          ? muscleLabel(secondarySlug, exercise.body_part)
          : null,
    };
  }, [exercise.target, exercise.body_part]);

  const name = getExerciseDisplayName(exercise);

  return (
    <section aria-label={HUB_DEMO_LABELS.musclesAriaLabel(name)} style={panel}>
      <MuscleReadonlyMap
        counts={counts}
        label={HUB_DEMO_LABELS.musclesAriaLabel(name)}
      />

      <dl style={definitionList}>
        <div style={definitionRow}>
          <dt style={termStyle}>{HUB_DEMO_LABELS.primaryMuscles}</dt>
          <dd style={definition}>{primary ?? exercise.target}</dd>
        </div>
        {secondary ? (
          <div style={definitionRow}>
            <dt style={termStyle}>{HUB_DEMO_LABELS.secondaryMuscles}</dt>
            <dd style={definition}>{secondary}</dd>
          </div>
        ) : null}
        <div style={definitionRow}>
          <dt style={termStyle}>Equipamiento</dt>
          <dd style={definition}>
            {EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}
          </dd>
        </div>
        <div style={definitionRow}>
          <dt style={termStyle}>Zona</dt>
          <dd style={definition}>
            {BODY_PART_LABELS[exercise.body_part] ?? exercise.body_part}
          </dd>
        </div>
      </dl>

      {error ? (
        <p style={hintStyle}>
          No pudimos leer el historial de este ejercicio, así que el mapa solo muestra lo que
          hay registrado.
        </p>
      ) : null}
      {loading && !error ? <p style={hintStyle}>Cargando historial…</p> : null}
      {!loading && !error && sessions.length === 0 ? (
        <p style={hintStyle}>
          Todavía no has registrado series de este ejercicio: el mapa se llenará cuando
          entrenes.
        </p>
      ) : null}
    </section>
  );
}

/**
 * The Spanish name of an anatomy muscle, falling back to the catalog's own string.
 *
 * The fallback is the point: a catalog `target` with no anatomy mapping still has to be
 * *named* on this screen. Showing nothing would leave a heading with an empty value, which
 * is worse than showing the catalog's English word.
 */
function muscleLabel(slug: Slug, fallback: string): string {
  return muscleDefinition(slug)?.label ?? fallback;
}

/** The catalog `target` for an exercise, resolved to an anatomy slug. */
function slugForTarget(target: string): Slug | null {
  return MUSCLES_BY_TARGET.get(target) ?? null;
}

function slugForBodyPart(bodyPart: string): Slug | null {
  return MUSCLES_BY_BODY_PART.get(bodyPart) ?? null;
}

/**
 * The warm-up ramp, and the one place in the app that can add sets to a live session.
 *
 * The ramp is *offered*, never applied on open. Someone who opens this to look at the
 * numbers should not come back to a session with three new rows in it.
 */
function WarmupPanel({
  exerciseName,
  workingKg,
  formatWeight,
}: {
  exerciseName: string;
  workingKg: number | null;
  formatWeight: (kg: number) => string;
}) {
  const gym = useGymSettings();
  const { isActive, enqueueWarmup } = useActiveSession();
  const [queued, setQueued] = useState<number | null>(null);

  const ramp = useMemo(() => {
    if (workingKg === null) return [];
    return warmupSets(workingKg, gym.barKg, gym.loadableInventory);
  }, [workingKg, gym.barKg, gym.loadableInventory]);

  const insert = useCallback(() => {
    if (ramp.length === 0) return;
    enqueueWarmup({ exerciseName, weights: ramp });
    setQueued(ramp.length);
  }, [enqueueWarmup, exerciseName, ramp]);

  return (
    <section aria-label={HUB_DEMO_LABELS.warmup} style={panel}>
      <header style={panelHeader}>
        <h2 style={panelTitle}>
          <Flame size={15} aria-hidden="true" style={{ color: STATUS.warning.text }} />
          {HUB_DEMO_LABELS.warmup}
        </h2>
      </header>

      {workingKg === null ? (
        <p style={hintStyle}>
          {HUB_DEMO_LABELS.warmupWorkingWeightHint} Necesitas al menos una serie registrada
          para calcular una rampa.
        </p>
      ) : ramp.length === 0 ? (
        <p style={hintStyle}>{HUB_DEMO_LABELS.warmupEmpty}</p>
      ) : (
        <>
          <p style={hintStyle}>{HUB_DEMO_LABELS.warmupNote}</p>

          <ul
            aria-label={HUB_DEMO_LABELS.warmupRampAriaLabel(
              ramp.map((kg) => formatWeight(kg)).join(", "),
            )}
            style={rampList}
          >
            {ramp.map((kg, index) => (
              <li key={kg} style={rampItem}>
                <span style={rampStep}>{rampFraction(index)}</span>
                <span style={rampWeight}>{formatWeight(kg)}</span>
              </li>
            ))}
          </ul>

          <button type="button" onClick={insert} disabled={!isActive} style={insertButton}>
            <Sparkles size={15} aria-hidden="true" />
            {isActive ? HUB_DEMO_LABELS.warmupInsert : HUB_DEMO_LABELS.warmupNoSession}
          </button>

          {queued !== null ? (
            <p role="status" aria-live="polite" style={queuedStyle}>
              {HUB_DEMO_LABELS.warmupQueued(queued)}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * The percentage beside each step.
 *
 * Read off `WARMUP_RAMP` rather than recomputed from the weight, because the *snapped*
 * weight is not the exact fraction -- 40% of 92.5 snapped to the rack is 40 kg, not 37.
 * Printing "40%" next to "40 kg" is correct; printing "43%" next to it would be arithmetic
 * pretending the rack does not exist.
 */
function rampFraction(index: number): string {
  return `${Math.round((WARMUP_RAMP[index] ?? 0) * 100)}%`;
}

const column: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.md,
};

const panel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
  padding: SPACE.card,
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

const panelHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.sm,
};

const panelTitle: CSSProperties = {
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: TYPE.headline.size,
  fontWeight: TYPE.headline.weight,
  color: TEXT.primary,
};

const mediaFrame: CSSProperties = {
  width: "100%",
  aspectRatio: "16 / 9",
  borderRadius: RADIUS.card,
  overflow: "hidden",
  border: `1px solid ${GLASS.border}`,
  boxShadow: GLASS.shadow,
};

const placeholder: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: `0 ${SPACE.lg}`,
  // `DIAGRAM.regionFill`, not `SURFACE.elevated`: this is a figure with nothing in it, and
  // `regionFill` is the token for the inside of a drawn region.
  background: DIAGRAM.regionFill,
  color: TEXT.disabled,
  fontSize: TYPE.caption.size,
  textAlign: "center",
};

const definitionList: CSSProperties = {
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: SPACE.xs,
};

const definitionRow: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: SPACE.sm,
};

const termStyle: CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.disabled,
  flexShrink: 0,
};

const definition: CSSProperties = {
  margin: 0,
  fontSize: TYPE.caption.size,
  color: TEXT.primary,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  color: TEXT.tertiary,
};

const rampList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  gap: SPACE.xs,
};

const rampItem: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: `${SPACE.sm} 0`,
  borderRadius: RADIUS.control,
  background: GLASS.fillRaised,
  border: `1px solid ${GLASS.border}`,
};

const rampStep: CSSProperties = {
  fontSize: TYPE.label.size,
  color: TEXT.disabled,
  fontVariantNumeric: "tabular-nums",
};

const rampWeight: CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.mono.weight,
  color: TEXT.primary,
};

const insertButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: SPACE.sm,
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.control,
  border: `1px solid ${STATUS.warning.border}`,
  background: STATUS.warning.muted,
  color: STATUS.warning.text,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
  cursor: "pointer",
};

const queuedStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.caption.size,
  color: STATUS.success.text,
};

/**
 * Catalog `target` -> anatomy slug, for the two headings.
 *
 * Built from `MUSCLE_DEFINITIONS` rather than typed out, because a hand-written map is a
 * second copy of the `targets` column and the two would drift on the first muscle added.
 * `MUSCLE_DEFINITIONS` is imported for its own sake elsewhere, so this costs nothing.
 */
const MUSCLES_BY_TARGET = new Map<string, Slug>(
  MUSCLE_DEFINITIONS.flatMap((m) => m.targets.map((target) => [target, m.slug] as const)),
);

const MUSCLES_BY_BODY_PART = new Map<string, Slug>(
  MUSCLE_DEFINITIONS.flatMap((m) => m.bodyParts.map((part) => [part, m.slug] as const)),
);