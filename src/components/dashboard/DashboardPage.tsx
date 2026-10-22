/**
 * DashboardPage.tsx â€” Cronos Gym home dashboard.
 *
 * "Precision in Motion" â€” a training cockpit that fuses glass-optical
 * surfaces, sport instrumentation, editorial typography and a technical
 * muscle map into a single focused screen.
 *
 * The component is pure composition: all data flows from useDashboardHome,
 * all computation lives in the pure helpers, and the JSX below is organised
 * into private sub-components that are cohesive to this screen.
 *
 * Design tokens are consumed exclusively from src/design/tokens.ts.
 * Icons are Lucide React.  No hex values, no Tailwind colour classes.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Clock,
  Dumbbell,
  Trophy,
  RefreshCw,
  AlertTriangle,
  History,
  Plus,
  CheckCircle2,
} from "lucide-react";
import type { Slug } from "react-muscle-highlighter";

import { useDashboardHome } from "@/lib/dashboard/dashboardHomeModel";
import { WEEKDAY_SHORT_ES } from "@/lib/dashboard/heroCardModel";
import type {
  CompletedSessionSummary,
  VolumeTrendResult,
} from "@/lib/dashboard/dashboardMetrics";
import {
  formatOneRepMax,
  formatDateRelative,
  formatWeight,
  formatDelta,
} from "@/lib/dashboard/formatters";
import { PROGRESS_PATH, ROUTINES_PATH, TRAIN_PATH } from "@/components/shell/navItems";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { VolumeSparkline } from "@/components/ui/VolumeSparkline";
import { GlassButton } from "@/components/ui/GlassButton";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useElapsedMs, formatElapsed } from "@/hooks/useElapsedMs";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import {
  useActiveSetProgress,
  type ActiveSetProgress,
} from "@/hooks/useActiveSetProgress";

import {
  ACCENT,
  GLASS,
  GRADIENTS,
  DIAGRAM,
  STATUS,
  SOLID,
  SURFACE_ROLE,
  TEXT,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
} from "@/design/tokens";

import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * A stable empty muscle distribution, so the hero's anatomy renders the
 * full-body graphite state without giving the diagram's memo a new map
 * reference on every render.
 */
const EMPTY_MUSCLE_COUNTS = new Map<Slug, number>();

/** Invitation shown under the anatomy when no routine is selected. */
const ANATOMY_IDLE_HINT =
  "Elige una rutina para ver los mÃºsculos que trabajarÃ¡";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardPageProps {
  userId: string;
}

// ---------------------------------------------------------------------------
// Glass surface primitive â€” Level-1 card
// ---------------------------------------------------------------------------

interface GlassSurfaceProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  raised?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

function GlassSurface({
  children,
  style,
  className,
  raised = false,
  onClick,
  ariaLabel,
}: GlassSurfaceProps) {
  const reduced = useReducedMotion();
  const fill = raised ? GLASS.fillRaised : GLASS.fill;
  const shadow = raised ? GLASS.shadow : undefined;

  return (
    <div
      role={onClick ? "button" : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
      style={{
        borderRadius: RADIUS.card,
        background: SURFACE_ROLE.canvas,
        border: `1px solid ${GLASS.border}`,
        boxShadow: shadow ?? "none",
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: reduced
          ? undefined
          : `border-color ${MOTION.fast} ${MOTION.standard}`,
        ...style,
      } as CSSProperties}
    >
      {/* Liquid-glass fill layer */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: RADIUS.card,
          background: fill,
          backdropFilter: "blur(16px) saturate(140%)",
          WebkitBackdropFilter: "blur(16px) saturate(140%)",
          pointerEvents: "none",
        }}
      />
      {/* Inner highlight */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: RADIUS.card,
          background: GRADIENTS.glassHighlight,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: SPACE.card,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstrumentationChip â€” compact data pair with icon
// ---------------------------------------------------------------------------

function InstrumentationChip({
  icon,
  value,
  loading = false,
}: {
  icon: ReactNode;
  value: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: SPACE.xs,
        padding: `${SPACE.xs}px ${SPACE.sm}px`,
        borderRadius: RADIUS.chip,
        background: GLASS.border,
        border: `1px solid ${GLASS.border}`,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          color: TEXT.secondary,
          fontSize: TYPE.caption.size,
        }}
      >
        {icon}
      </span>
      {loading ? (
        <span style={{ color: TEXT.tertiary, fontSize: TYPE.mono.size }}>
          --
        </span>
      ) : (
        <span
          style={{
            color: TEXT.primary,
            fontSize: TYPE.mono.size,
            fontWeight: TYPE.mono.weight,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrainingCockpit â€” the Hero component
// ---------------------------------------------------------------------------

function TrainingCockpit({
  loading,
  greeting,
  routineTitle,
  routine,
  dayName,
  dayLabel,
  isRestDay,
  muscleCounts,
  completedSession,
  activeStartedAt,
  setProgress,
  onPrimary,
  onCreateRoutine,
  sessionState,
}: {
  loading: boolean;
  greeting: string;
  routineTitle: string | null;
  routine: {
    title: string;
    exerciseCount: number;
    estimatedDurationMin: number;
  } | null;
  dayName: string;
  dayLabel: string | null;
  isRestDay: boolean;
  muscleCounts: Map<Slug, number> | null;
  completedSession: CompletedSessionSummary | null;
  /** ISO start of the running session, or null. Feeds the elapsed clock. */
  activeStartedAt: string | null;
  /** Completed/planned sets of the running session, from its persisted draft. */
  setProgress: ActiveSetProgress;
  onPrimary: () => void;
  /** Secondary action in the no-routine state: go build a routine. */
  onCreateRoutine: () => void;
  sessionState: "idle" | "scheduled" | "in-progress" | "completed";
}) {
  const reduced = useReducedMotion();
  // The one clock in the app. A null start â€” no session, or a session that
  // has already ended â€” reads as zero and runs no interval, so a finished
  // session never keeps ticking here.
  const elapsedMs = useElapsedMs(activeStartedAt);
  const badgeText =
    sessionState === "in-progress"
      ? "EN CURSO"
      : sessionState === "completed"
        ? "COMPLETADA"
        : sessionState === "scheduled"
          ? "SESIÃ“N PROGRAMADA"
          : "PREPARADO";

  const badgeColor =
    sessionState === "in-progress"
      ? ACCENT.text
      : sessionState === "completed"
        ? STATUS.success.text
        : sessionState === "scheduled"
          ? STATUS.progression.text
          : TEXT.tertiary;

  const title =
    sessionState === "completed" && completedSession
      ? completedSession.title
      : (routineTitle ?? "SesiÃ³n libre");

  const cta =
    sessionState === "completed"
      ? { label: "Ver historial", icon: <History size={16} /> }
      : sessionState === "in-progress"
        ? { label: "Continuar entrenamiento", icon: <Play size={16} /> }
        : { label: "Comenzar entrenamiento", icon: <Play size={16} /> };

  /**
   * The hero's anatomy renders in every state: the muscle distribution
   * when a routine is planned, the full-body graphite figure with its
   * invitation when none is. A single column layout would leave the
   * hero half-empty, so the figure keeps its place on the right.
   */
  const anatomyCounts =
    muscleCounts && muscleCounts.size > 0
      ? muscleCounts
      : EMPTY_MUSCLE_COUNTS;
  const anatomyIdleHint =
    muscleCounts && muscleCounts.size > 0 ? undefined : ANATOMY_IDLE_HINT;

  return (
    <GlassSurface
      raised
      className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-6 md:gap-[32px]"
      style={{
        minHeight: "280px",
        padding: SPACE.card,
      }}
    >
      {/* Left: context + routine info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
          minWidth: 0,
        }}
      >
          {/* Session header badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.xs,
              padding: `${SPACE.xs}px ${SPACE.md}px`,
              borderRadius: RADIUS.pill,
              background: GLASS.fill,
              border: `1px solid ${GLASS.border}`,
              alignSelf: "flex-start",
            }}
          >
            <span
              aria-hidden="true"
              style={{
              width: SPACE.sm,
              height: SPACE.sm,
              borderRadius: RADIUS.round,
              background: badgeColor,
              ...(sessionState === "in-progress"
                ? {
                  boxShadow: ACCENT.ring,
                }
                : {}),
            }}
          />
          <span
            style={{
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              letterSpacing: TYPE.caption.tracking,
              color: TEXT.tertiary,
              textTransform: "uppercase",
            }}
          >
            HOY
          </span>
          <span style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>
            Â·
          </span>
          <span
            style={{
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              letterSpacing: TYPE.caption.tracking,
              color: badgeColor,
              textTransform: "uppercase",
            }}
          >
            {dayName ? `${dayName.toUpperCase()}` : ""}
          </span>
          <span style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>
            Â·
          </span>
          <span
            style={{
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              letterSpacing: TYPE.caption.tracking,
              color: badgeColor,
              textTransform: "uppercase",
            }}
          >
            {badgeText}
          </span>
        </div>

        {/*
         * Elapsed time â€” the running session's vital sign. Rendered only
         * while a session is actually in progress: the clock is derived
         * from `startedAt` via the app's single clock, and a session that
         * has ended (its context entry is gone) reads as zero and runs no
         * interval, so a completed workout never keeps ticking here.
         */}
        {sessionState === "in-progress" && !loading && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: SPACE.xs,
              alignSelf: "flex-start",
            }}
          >
            <span
              aria-live="polite"
              aria-label={`Tiempo transcurrido: ${formatElapsed(elapsedMs)}`}
              style={{
                fontFamily: TYPE.mono.font,
                fontVariantNumeric: "tabular-nums",
                fontSize: TYPE.headline.size,
                fontWeight: TYPE.headline.weight,
                color: TEXT.primary,
              }}
            >
              {formatElapsed(elapsedMs)}
            </span>
            <span
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.tertiary,
                textTransform: "uppercase",
                letterSpacing: TYPE.caption.tracking,
              }}
            >
              transcurrido
            </span>
          </div>
        )}

        {/* Greeting + Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
          }}
        >
          {loading ? (
            <>
              <div
                style={{
                  height: "28px",
                  width: "60%",
                  borderRadius: RADIUS.sm,
                  background: GLASS.fill,
                }}
              />
              <div
                style={{
                  height: "24px",
                  width: "40%",
                  borderRadius: RADIUS.sm,
                  background: GLASS.fill,
                  marginTop: SPACE.xs,
                }}
              />
            </>
          ) : routine || completedSession ? (
            <>
              <p
                style={{
                  ...TYPE.callout,
                  color: TEXT.secondary,
                  margin: 0,
                }}
              >
                {greeting}
              </p>
              <h1
                style={{
                  ...TYPE.hero,
                  color: TEXT.primary,
                  margin: 0,
                  wordBreak: "break-word",
                }}
              >
                {title}
              </h1>
              {sessionState === "completed" && completedSession ? (
                <p
                  style={{
                    fontSize: TYPE.body.size,
                    lineHeight: TYPE.body.lineHeight,
                    color: STATUS.success.text,
                    margin: 0,
                  }}
                >
                  SesiÃ³n completada hoy Â· {completedSession.durationMin} min Â·{" "}
                  {completedSession.setCount} series de trabajo
                </p>
              ) : (
                dayLabel &&
                !isRestDay && (
                  <p
                    style={{
                      fontSize: TYPE.body.size,
                      lineHeight: TYPE.body.lineHeight,
                      color: TEXT.secondary,
                      margin: 0,
                    }}
                  >
                    {dayLabel}
                  </p>
                )
              )}
            </>
          ) : (
            <>
              <p
                style={{
                  ...TYPE.callout,
                  color: TEXT.secondary,
                  margin: 0,
                }}
              >
                {greeting}
              </p>
              <h1
                style={{
                  ...TYPE.hero,
                  color: TEXT.primary,
                  margin: 0,
                }}
              >
                Rutina del dÃ­a
              </h1>
              <p
                style={{
                  fontSize: TYPE.body.size,
                  lineHeight: TYPE.body.lineHeight,
                  color: TEXT.tertiary,
                  margin: 0,
                }}
              >
                Crea tu primera rutina para empezar
              </p>
            </>
          )}
        </div>

        {/* Instrumentation chips */}
        {loading ? (
          <div style={{ display: "flex", gap: SPACE.xs }}>
            <div
              style={{
                height: "24px",
                width: "80px",
                borderRadius: RADIUS.chip,
                background: GLASS.fill,
              }}
            />
            <div
              style={{
                height: "24px",
                width: "80px",
                borderRadius: RADIUS.chip,
                background: GLASS.fill,
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", gap: SPACE.xs, flexWrap: "wrap" }}>
            {sessionState === "completed" && completedSession ? (
              <>
                <InstrumentationChip
                  icon={<Dumbbell size={14} />}
                  value={`${completedSession.exerciseCount} ej`}
                />
                <InstrumentationChip
                  icon={<Clock size={14} />}
                  value={`${completedSession.durationMin} min`}
                />
                <InstrumentationChip
                  icon={<Trophy size={14} />}
                  value={`${completedSession.setCount} series`}
                />
              </>
            ) : (
              <>
                {routine && (
                  <InstrumentationChip
                    icon={<Dumbbell size={14} />}
                    value={`${routine.exerciseCount} ej`}
                  />
                )}
                {routine && routine.estimatedDurationMin > 0 && (
                  <InstrumentationChip
                    icon={<Clock size={14} />}
                    value={`${routine.estimatedDurationMin} min`}
                  />
                )}
                {/*
                 * Sets completed vs planned, read from the session's own
                 * persisted draft. Shown only while a session is running and
                 * only when the plan has sets to count: a zero-set plan has
                 * no progress to express, and an idle or completed session
                 * has no running count to show.
                 */}
                {sessionState === "in-progress" &&
                  setProgress.plannedSets > 0 && (
                    <InstrumentationChip
                      icon={<CheckCircle2 size={14} />}
                      value={`${setProgress.doneSets}/${setProgress.plannedSets} series`}
                    />
                  )}
              </>
            )}
          </div>
        )}

        {/*
         * Set progress bar â€” the same completed/planned pair as the chip,
         * as a bar. Real data only: both numbers come from the draft the
         * workout screen writes, so nothing here is invented to fill space.
         */}
        {sessionState === "in-progress" &&
          !loading &&
          setProgress.plannedSets > 0 && (
            <div
              role="progressbar"
              aria-valuenow={setProgress.doneSets}
              aria-valuemin={0}
              aria-valuemax={setProgress.plannedSets}
              aria-label={`Series completadas: ${setProgress.doneSets} de ${setProgress.plannedSets}`}
              style={{
                height: 4,
                borderRadius: RADIUS.sm,
                background: SOLID.card,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${
                    Math.min(
                      1,
                      setProgress.plannedSets > 0
                        ? setProgress.doneSets / setProgress.plannedSets
                        : 0,
                    ) * 100
                  }%`,
                  height: "100%",
                  background: ACCENT.base,
                  transition: reduced
                    ? undefined
                    : `width ${MOTION.fast} ${MOTION.standard}`,
                }}
              />
            </div>
          )}

        {/* Single CTA â€” full width on mobile for thumb-friendly tap */}
        <div style={{ marginTop: SPACE.sm }}>
          {loading ? (
            <div
              style={{
                height: "44px",
                width: "160px",
                borderRadius: RADIUS.control,
                background: GLASS.fill,
              }}
            />
          ) : (
            <>
              <GlassButton
                variant="primary"
                block
                icon={cta.icon}
                onClick={onPrimary}
                style={{
                  minHeight: SPACE["3xl"],
                  boxShadow: ACCENT.ring,
                  fontSize: TYPE.subhead.size,
                  gap: SPACE.xs,
                }}
              >
                {cta.label}
              </GlassButton>
              {/*
               * Secondary action, only when there is no routine to start.
               * The primary stays "Comenzar entrenamiento" (a free session);
               * this is the path to building the plan itself. Hidden once a
               * routine exists or a session is running or done, where a
               * second action would only duplicate what the state offers.
               */}
              {routine === null &&
                (sessionState === "idle" || sessionState === "scheduled") && (
                  <GlassButton
                    variant="secondary"
                    block
                    icon={<Plus size={16} />}
                    onClick={onCreateRoutine}
                    style={{ marginTop: SPACE.xs }}
                  >
                    Crear rutina
                  </GlassButton>
                )}
            </>
          )}
        </div>
      </div>

      {/*
       * Right: anatomical visualization â€” always present.
       *
       * The brief's rule: the diagram never disappears for lack of
       * information. Without a routine it renders the complete figure
       * in graphite (every region at the inert fill) with the
       * invitation as its caption. The start action itself lives in
       * the hero's CTA, so the caption is text, not a second button.
       */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "120px", height: "192px" }}>
          <MuscleReadonlyMap
            counts={anatomyCounts}
            idleHint={anatomyIdleHint}
            label="Torso anatÃ³mico"
            aspectRatio={120 / 192}
          />
        </div>
      </div>
    </GlassSurface>
  );
}

// ---------------------------------------------------------------------------
// ConsistencyRing â€” weekly progress ring with streak
// ---------------------------------------------------------------------------

function ConsistencyRing({
  loading,
  completed,
  goal,
  currentDays,
  longestWeeks,
  volumeTrend,
  unitSystem,
}: {
  loading: boolean;
  completed: number;
  goal: number;
  currentDays: number;
  longestWeeks: number;
  /** The trailing week's volume, day by day, plus its delta. */
  volumeTrend: VolumeTrendResult | null;
  unitSystem: "metric" | "imperial";
}) {
  const reduced = useReducedMotion();
  // The aggregate the ring's card has always reported; the
  // trend below it is the same numbers, day by day.
  const totalVolume = volumeTrend
    ? volumeTrend.points.reduce((sum, point) => sum + point.volumeKg, 0)
    : null;
  const radius = 48;
  const strokeWidth = 6;
  const circumference = (2 * Math.PI * radius) / 2;
  const pct = goal > 0 ? Math.min(1, completed / goal) : 0;
  const offset = circumference * (1 - pct);

  return (
    <GlassSurface raised style={{ padding: 0, height: "100%" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: SPACE.sm,
          padding: SPACE.card,
        }}
      >
        <h2
          style={{
            ...TYPE.title2,
            color: TEXT.secondary,
            margin: 0,
          }}
        >
          Consistencia
        </h2>

        {loading ? (
          <div
            style={{
              width: `${radius * 2 + strokeWidth * 2}px`,
              height: `${radius * 2 + strokeWidth * 2}px`,
              borderRadius: "50%",
              background: GLASS.fill,
            }}
          />
        ) : (
          <>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width={radius * 2 + strokeWidth * 2}
                height={radius * 2 + strokeWidth * 2}
                viewBox={`0 0 ${radius * 2 + strokeWidth} ${radius * 2 + strokeWidth}`}
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx={radius + strokeWidth / 2}
                  cy={radius + strokeWidth / 2}
                  r={radius}
                  fill="none"
                  stroke={DIAGRAM.inert}
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx={radius + strokeWidth / 2}
                  cy={radius + strokeWidth / 2}
                  r={radius}
                  fill="none"
                  stroke={ACCENT.base}
                  strokeWidth={strokeWidth}
                   strokeDasharray={circumference}
                   strokeDashoffset={offset}
                   strokeLinecap="round"
                   style={{
                     transition: reduced
                       ? undefined
                       : `stroke-dashoffset ${MOTION.normal} ${MOTION.easeOut}`,
                   }}
                 />
              </svg>
              <div
                style={{
                  position: "absolute",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: TYPE.mono.size,
                    fontWeight: TYPE.mono.weight,
                    color: TEXT.primary,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {completed}
                  <span style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}>
                    /{goal}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: SPACE["2xl"],
                alignItems: "center",
                textAlign: "center",
              }}
            >
                             <div>
                <div
                  style={{
                    fontSize: TYPE.mono.size,
                    fontWeight: TYPE.mono.weight,
                    color: ACCENT.base,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {currentDays}d
                </div>
                <div
                  style={{
                    fontSize: TYPE.caption.size,
                    color: TEXT.tertiary,
                  }}
                >
                  Racha diaria
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: TYPE.mono.size,
                    fontWeight: TYPE.mono.weight,
                    color: TEXT.primary,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {longestWeeks}w
                </div>
                <div
                  style={{
                    fontSize: TYPE.caption.size,
                    color: TEXT.tertiary,
                  }}
                >
                  RÃ©cord semanal
                </div>
              </div>
              {volumeTrend && totalVolume !== null && totalVolume > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: SPACE.xs,
                  }}
                >
                  <div
                    style={{
                      fontSize: TYPE.mono.size,
                      fontWeight: TYPE.mono.weight,
                      color: TEXT.primary,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatWeight(totalVolume, unitSystem)}
                  </div>
                  <div
                    style={{
                      fontSize: TYPE.caption.size,
                      color: TEXT.tertiary,
                    }}
                  >
                    Volumen (7d)
                  </div>
                  {/*
                   * The shape and the direction of that
                   * volume: the sparkline is the trailing
                   * week, day by day, and the delta is the
                   * same week against the one before it.
                   * Both are the real numbers â€” a week with
                   * no volume hides the whole stat rather
                   * than drawing a graph with nothing in it.
                   * The delta keeps a neutral colour: a down
                   * week is a deload or a rest, not an error,
                   * and the sign already says which way it went.
                   */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: SPACE.xs,
                    }}
                  >
                    <VolumeSparkline points={volumeTrend.points} />
                    <span
                      style={{
                        fontSize: TYPE.caption.size,
                        color: TEXT.secondary,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDelta(volumeTrend.deltaPct)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </GlassSurface>
  );
}

// ---------------------------------------------------------------------------
// WeeklyRhythm â€” 7-day timeline (Monâ†’Sun, single row)
// ---------------------------------------------------------------------------

function WeeklyRhythm({
  loading,
  planDays,
  progress,
}: {
  loading: boolean;
  planDays: readonly {
    dayName: string;
    dayLabel: string | null;
    isToday: boolean;
    trained: boolean;
  }[];
  progress: { completed: number; goal: number } | null;
}) {
  /**
   * The strip keeps its seven day labels and its baseline even with no
   * history -- a week that has not started is not an error state -- but
   * it says so, so the empty strip reads as deliberate rather than broken.
   */
  const weekIsEmpty = progress !== null && progress.completed === 0;

  return (
    <GlassSurface raised>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ ...TYPE.title2, color: TEXT.secondary, margin: 0 }}>
            Esta semana
          </h2>
          {progress && !loading && (
            <span
              style={{
                fontSize: TYPE.mono.size,
                fontWeight: TYPE.mono.weight,
                color: TEXT.primary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {progress.completed}/{progress.goal}
            </span>
          )}
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              gap: SPACE.sm,
              justifyContent: "space-between",
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: RADIUS.round,
                  background: GLASS.fill,
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              gap: SPACE.sm,
              justifyContent: "space-between",
            }}
          >
            {planDays.map((day, idx) => {
              const isToday = day.isToday;
              const trained = day.trained;

              const bg = isToday
                ? ACCENT.base
                : trained
                  ? GLASS.fillRaised
                  : GLASS.fill;
              const border = isToday ? ACCENT.border : GLASS.border;
              const color = isToday ? TEXT.onAccent : trained ? TEXT.primary : TEXT.tertiary;
              const halo = isToday ? ACCENT.ring : undefined;

              const shortName = WEEKDAY_SHORT_ES[idx] ?? day.dayName.slice(0, 1);

              return (
                <div
                  key={day.dayName}
                  title={day.dayLabel ?? undefined}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: SPACE.xs,
                  }}
                >
                  <span
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: RADIUS.round,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: TYPE.caption.size,
                      fontWeight: isToday ? TYPE.caption.weight : undefined,
                      color,
                      background: bg,
                      border: `1px solid ${border}`,
                      boxShadow: halo,
                    }}
                  >
                    {shortName}
                  </span>
                  {day.dayLabel && !isToday && trained && (
                    <span
                      style={{
                        fontSize: TYPE.caption.size,
                        color: STATUS.progression.text,
                      }}
                    >
                      â€¢
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {weekIsEmpty && !loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.xs,
            }}
          >
            <p
              style={{
                ...TYPE.subhead,
                color: TEXT.secondary,
                margin: 0,
              }}
            >
              Tu semana comienza hoy
            </p>
            <p
              style={{
                fontSize: TYPE.caption.size,
                lineHeight: TYPE.caption.lineHeight,
                color: TEXT.tertiary,
                margin: 0,
              }}
            >
              Cuando registres tus entrenamientos, aquÃ­ podrÃ¡s ver tu
              constancia semanal.
            </p>
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

// ---------------------------------------------------------------------------
// PersonalRecords â€” editorial PR list
// ---------------------------------------------------------------------------

function PersonalRecords({
  loading,
  prs,
  unit,
  onStart,
}: {
  loading: boolean;
  prs: readonly { exerciseName: string; estimated1RM: number; achievedAt: string }[];
  unit: "metric" | "imperial";
  /** Navigation to the workout start, offered in the empty state. */
  onStart?: () => void;
}) {
  return (
    <GlassSurface raised>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
        }}
      >
        <h2 style={{ ...TYPE.title2, color: TEXT.secondary, margin: 0 }}>
          RÃ©cords recientes
        </h2>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
            <div
              style={{
                height: "20px",
                width: "100%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
            <div
              style={{
                height: "20px",
                width: "80%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
            <div
              style={{
                height: "20px",
                width: "60%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
          </div>
        ) : prs.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.sm,
              padding: `${SPACE.sm}px 0`,
            }}
          >
            <p
              style={{
                ...TYPE.subhead,
                color: TEXT.primary,
                margin: 0,
              }}
            >
              Cada progreso tiene un comienzo
            </p>
            <p
              style={{
                fontSize: TYPE.body.size,
                lineHeight: TYPE.body.lineHeight,
                color: TEXT.secondary,
                margin: 0,
              }}
            >
              Registra una sesiÃ³n para empezar a construir tu historial.
              Tus mejores cargas y repeticiones aparecerÃ¡n aquÃ­ al
              completar entrenamientos.
            </p>
            {onStart && (
              <div style={{ marginTop: SPACE.xs }}>
                <GlassButton
                  variant="ghost"
                  icon={<Play size={16} />}
                  onClick={onStart}
                >
                  Comenzar entrenamiento
                </GlassButton>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.sm,
            }}
          >
            {prs.map((pr) => (
              <div
                key={`${pr.exerciseName}-${pr.achievedAt}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `${SPACE.sm}px 0`,
                  borderBottom: `1px solid ${GLASS.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: SPACE.sm,
                    overflow: "hidden",
                  }}
                >
                  <span
                    aria-label="Marca personal"
                    title="Marca personal"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "20px",
                      height: "20px",
                      color: STATUS.pr.text,
                      fontSize: TYPE.caption.size,
                    }}
                  >
                    <Trophy size={16} />
                  </span>
                  <span
                    style={{
                      fontSize: TYPE.body.size,
                      color: TEXT.primary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                    title={getExerciseDisplayName({ name: pr.exerciseName })}
                  >
                    {getExerciseDisplayName({ name: pr.exerciseName })}
                  </span>
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      color: TEXT.tertiary,
                    }}
                  >
                    ({formatDateRelative(pr.achievedAt.split("T")[0], "es-ES", Date.now())})
                  </span>
                </div>

                <div
                  style={{
                    fontSize: TYPE.mono.size,
                    fontWeight: TYPE.mono.weight,
                    color: ACCENT.base,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatOneRepMax(pr.estimated1RM, unit)}
                  <span
                    style={{
                      fontSize: TYPE.caption.size,
                      color: TEXT.tertiary,
                      marginLeft: SPACE.xs,
                    }}
                  >
                    est.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

// ---------------------------------------------------------------------------
// Main DashboardPage
// ---------------------------------------------------------------------------

export function DashboardPage({ userId }: DashboardPageProps) {
  const navigate = useNavigate();
  const data = useDashboardHome(userId);

  const sessionState = data.isSessionActive
    ? "in-progress"
    : data.completedToday
      ? "completed"
      : data.dailyFocus.isRestDay
        ? "scheduled"
        : "idle";

  const muscleCounts = useMemo(() => {
    if (!data.suggestedRoutine) return null;
    return data.muscleCounts;
  }, [data.muscleCounts, data.suggestedRoutine]);

  // The running session's set progress, read from the draft the workout
  // screen persists. Zeros unless a session is actually active, and it
  // only ever counts sets from the draft whose startedAt matches the
  // running session â€” a stale draft is another workout, not this one.
  const setProgress = useActiveSetProgress(userId, data.activeSession);
  const activeStartedAt = data.activeSession?.startedAt ?? null;

  const firstError = useMemo(() => {
    for (const value of Object.values(data.errors)) {
      if (value !== null) return value;
    }
    return null;
  }, [data.errors]);

  /**
   * The start-training action, shared by the hero and the empty
   * records card. Always starts (when a routine is suggested) and
   * always lands on the workout screen -- unlike the hero's primary,
   * which diverts to the history view once today's session is done.
   */
  const handleStartTraining = () => {
    if (!data.activeSession && data.suggestedRoutine) {
      data.startSession({
        id: data.suggestedRoutine.id,
        title: data.suggestedRoutine.title,
      });
    }
    navigate(TRAIN_PATH);
  };

  const handlePrimary = () => {
    if (sessionState === "completed") {
      navigate(PROGRESS_PATH);
      return;
    }
    handleStartTraining();
  };

  const handleRefresh = () => {
    void data.refreshAll();
  };

  /**
   * The no-routine state's secondary action. `/rutinas` is the screen
   * that owns routine creation (its "Nueva rutina" form lives there);
   * there is no deeper route to aim at, so this is the real destination.
   */
  const handleCreateRoutine = () => {
    navigate(ROUTINES_PATH);
  };

  return (
    <div
      className="w-full flex flex-col gap-4 md:gap-6 p-4 md:p-6"
      style={{
        /*
         * Radial red accent gradient at the top, composited over the true-black
         * canvas. `ACCENT.muted` is 12% tint â€” a glow, not a wash â€” and fades to
         * transparent so it never competes with the card chrome. The canvas sits
         * beneath so OLED pixels stay off outside the halo.
         */
        background: `radial-gradient(circle at top, ${ACCENT.muted} 0%, transparent 60%), ${SURFACE_ROLE.canvas}`,
      }}
    >
      {/* Recoverable error â€” shown only when a source failed and is not loading */}
      {firstError !== null && !data.loading && (
        <GlassSurface
          raised
          style={{
            border: `1px solid ${STATUS.error.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE.md,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACE.sm,
                color: STATUS.error.text,
                fontSize: TYPE.body.size,
              }}
            >
              <span aria-hidden="true" style={{ display: "inline-flex" }}>
                <AlertTriangle size={20} />
              </span>
              <span>{firstError}</span>
            </div>
            <GlassButton
              variant="primary"
              icon={<RefreshCw size={16} />}
              onClick={handleRefresh}
            >
              Reintentar
            </GlassButton>
          </div>
        </GlassSurface>
      )}

      {/* Hero â€” Training Cockpit */}
      <TrainingCockpit
        loading={data.loading}
        greeting={data.greeting}
        routineTitle={data.suggestedRoutine?.title ?? null}
        routine={data.heroRoutineSummary}
        dayName={data.dailyFocus.dayName}
        dayLabel={data.dailyFocus.dayLabel}
        isRestDay={data.dailyFocus.isRestDay}
        muscleCounts={muscleCounts}
        completedSession={data.completedToday}
        activeStartedAt={activeStartedAt}
        setProgress={setProgress}
        onPrimary={handlePrimary}
        onCreateRoutine={handleCreateRoutine}
        sessionState={sessionState}
      />

      {/* Bento grid â€” mobile: 1 column (touch-priority order), desktop: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Mobile order: 1=Esta Semana, 2=Consistencia, 3=RÃ©cords */}
        {/* Desktop order: 1=Consistencia, 2=Esta Semana, 3=RÃ©cords */}
        <div className="order-1 lg:order-2">
          <WeeklyRhythm
            loading={data.loading}
            planDays={data.weeklyPlan}
            progress={data.weeklyProgress}
          />
        </div>
        <div className="order-2 lg:order-1">
          <ConsistencyRing
            loading={data.loading}
            completed={data.weeklyProgress.completed}
            goal={data.weeklyProgress.goal}
            currentDays={data.streakStats?.currentDays ?? 0}
            longestWeeks={data.streakStats?.longestWeeks ?? 0}
            volumeTrend={data.volumeTrend}
            unitSystem={data.unitSystem}
          />
        </div>
        <div className="order-3 lg:order-3">
          <PersonalRecords
            loading={data.loading}
            prs={data.recentPRs}
            unit={data.unitSystem}
            onStart={handleStartTraining}
          />
        </div>
      </div>
    </div>
  );
}
