/**
 * DashboardPage.tsx — Cronos Gym home dashboard.
 *
 * "Precision in Motion" — a training cockpit that fuses glass-optical
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
} from "lucide-react";
import type { Slug } from "react-muscle-highlighter";

import { useDashboardHome } from "@/lib/dashboard/dashboardHomeModel";
import { WEEKDAY_SHORT_ES } from "@/lib/dashboard/heroCardModel";
import {
  formatOneRepMax,
  formatDateRelative,
  formatWeight,
} from "@/lib/dashboard/formatters";
import { TRAIN_PATH } from "@/components/shell/navItems";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { GlassButton } from "@/components/ui/GlassButton";
import { useReducedMotion } from "@/hooks/useReducedMotion";

import {
  ACCENT,
  GLASS,
  GRADIENTS,
  DIAGRAM,
  STATUS,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardPageProps {
  userId: string;
}

// ---------------------------------------------------------------------------
// Glass surface primitive — Level-1 card
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
// InstrumentationChip — compact data pair with icon
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
// TrainingCockpit — the Hero component
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
  onPrimary,
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
  onPrimary: () => void;
  sessionState: "idle" | "scheduled" | "in-progress";
}) {
  const badgeText =
    sessionState === "in-progress"
      ? "EN CURSO"
      : sessionState === "scheduled"
        ? "SESIÓN PROGRAMADA"
        : "PREPARADO";

  const badgeColor =
    sessionState === "in-progress"
      ? ACCENT.text
      : sessionState === "scheduled"
        ? STATUS.progression.text
        : TEXT.tertiary;

  const title = routineTitle ?? "Sesión libre";

  return (
    <GlassSurface
      raised
      className={muscleCounts && muscleCounts.size > 0
        ? "grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-6 md:gap-[32px]"
        : "grid grid-cols-1 items-center gap-6"}
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
            ·
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
            ·
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
          ) : routine ? (
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
              {dayLabel && !isRestDay && (
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
                Rutina del día
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
          </div>
        )}

        {/* Single CTA — full width on mobile for thumb-friendly tap */}
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
            <GlassButton
              variant="primary"
              block
              icon={<Play size={16} />}
              onClick={onPrimary}
              style={{
                minHeight: SPACE["3xl"],
                boxShadow: ACCENT.ring,
                fontSize: TYPE.subhead.size,
                gap: SPACE.xs,
              }}
            >
              Iniciar Sesión
            </GlassButton>
          )}
        </div>
      </div>

      {/* Right: anatomical visualization — only when muscle data exists */}
      {muscleCounts && muscleCounts.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "120px", height: "192px" }}>
            <MuscleReadonlyMap
              counts={muscleCounts}
              label="Torso anatómico"
              aspectRatio={120 / 192}
            />
          </div>
        </div>
      )}
    </GlassSurface>
  );
}

// ---------------------------------------------------------------------------
// ConsistencyRing — weekly progress ring with streak
// ---------------------------------------------------------------------------

function ConsistencyRing({
  loading,
  completed,
  goal,
  currentDays,
  longestWeeks,
  totalVolume,
  unitSystem,
}: {
  loading: boolean;
  completed: number;
  goal: number;
  currentDays: number;
  longestWeeks: number;
  totalVolume: number | null;
  unitSystem: "metric" | "imperial";
}) {
  const reduced = useReducedMotion();
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
                  Récord semanal
                </div>
              </div>
              {totalVolume !== null && totalVolume > 0 && (
                <div>
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
// WeeklyRhythm — 7-day timeline (Mon→Sun, single row)
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
                      •
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

// ---------------------------------------------------------------------------
// PersonalRecords — editorial PR list
// ---------------------------------------------------------------------------

function PersonalRecords({
  loading,
  prs,
  unit,
}: {
  loading: boolean;
  prs: readonly { exerciseName: string; estimated1RM: number; achievedAt: string }[];
  unit: "metric" | "imperial";
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
          Récords recientes
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
              alignItems: "center",
              justifyContent: "center",
              padding: `${SPACE.xl}px 0`,
              color: TEXT.tertiary,
              fontSize: TYPE.body.size,
            }}
          >
            Sin récords registrados esta semana
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
                    title={pr.exerciseName}
                  >
                    {pr.exerciseName}
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
    : data.dailyFocus.isRestDay
      ? "scheduled"
      : "idle";

  const muscleCounts = useMemo(() => {
    if (!data.suggestedRoutine) return null;
    return data.muscleCounts;
  }, [data.muscleCounts, data.suggestedRoutine]);

  const totalVolume = useMemo(() => {
    if (!data.volumeTrend) return null;
    return data.volumeTrend.points.reduce((sum, p) => sum + p.volumeKg, 0);
  }, [data.volumeTrend]);

  const firstError = useMemo(() => {
    for (const value of Object.values(data.errors)) {
      if (value !== null) return value;
    }
    return null;
  }, [data.errors]);

  const handlePrimary = () => {
    if (!data.activeSession && data.suggestedRoutine) {
      data.startSession({
        id: data.suggestedRoutine.id,
        title: data.suggestedRoutine.title,
      });
    }
    navigate(TRAIN_PATH);
  };

  const handleRefresh = () => {
    void data.refreshAll();
  };

  return (
    <div
      className="w-full flex flex-col gap-4 md:gap-6 p-4 md:p-6"
      style={{
        /*
         * Radial red accent gradient at the top, composited over the true-black
         * canvas. `ACCENT.muted` is 12% tint — a glow, not a wash — and fades to
         * transparent so it never competes with the card chrome. The canvas sits
         * beneath so OLED pixels stay off outside the halo.
         */
        background: `radial-gradient(circle at top, ${ACCENT.muted} 0%, transparent 60%), ${SURFACE_ROLE.canvas}`,
      }}
    >
      {/* Recoverable error — shown only when a source failed and is not loading */}
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

      {/* Hero — Training Cockpit */}
      <TrainingCockpit
        loading={data.loading}
        greeting={data.greeting}
        routineTitle={data.suggestedRoutine?.title ?? null}
        routine={data.heroRoutineSummary}
        dayName={data.dailyFocus.dayName}
        dayLabel={data.dailyFocus.dayLabel}
        isRestDay={data.dailyFocus.isRestDay}
        muscleCounts={muscleCounts}
        onPrimary={handlePrimary}
        sessionState={sessionState}
      />

      {/* Bento grid — mobile: 1 column (touch-priority order), desktop: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Mobile order: 1=Esta Semana, 2=Consistencia, 3=Récords */}
        {/* Desktop order: 1=Consistencia, 2=Esta Semana, 3=Récords */}
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
            totalVolume={totalVolume}
            unitSystem={data.unitSystem}
          />
        </div>
        <div className="order-3 lg:order-3">
          <PersonalRecords
            loading={data.loading}
            prs={data.recentPRs}
            unit={data.unitSystem}
          />
        </div>
      </div>
    </div>
  );
}
