import { ArrowRight, Play, RotateCcw, Sparkles, Plus } from "lucide-react";

import { GlassButton } from "@/components/ui/GlassButton";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { formatSessionMeta } from "@/lib/dashboard/heroCardModel";
import { ACCENT, GLASS, MOTION, NUMERIC, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { CompletedSessionSummary } from "@/lib/dashboard/dashboardMetrics";

export interface TrainingHeroSectionProps {
  greeting: string;
  hasRoutine: boolean;
  routineTitle: string;
  exerciseCount: number;
  estimatedDurationMin: number;
  muscleCounts: Map<string, number> | null;
  ctaLabel: string;
  rehydrating: boolean;
  onPrimary: () => void;
  focusLabel?: string | null;
  isCompleted?: boolean;
  isRecoverable?: boolean;
  completedSummary?: CompletedSessionSummary | null;
  onExtra?: () => void;
  /** Reduce altura y tamaño del mapa muscular en pantallas estrechas. */
  compact?: boolean;
}

export function TrainingHeroSection({
  greeting,
  hasRoutine,
  routineTitle,
  exerciseCount,
  estimatedDurationMin,
  muscleCounts,
  ctaLabel,
  rehydrating,
  onPrimary,
  focusLabel,
  isCompleted = false,
  isRecoverable = false,
  completedSummary = null,
  onExtra,
  compact = false,
}: TrainingHeroSectionProps) {
  const reduce = useReducedMotion();
  const isCompact = compact;
  const meta = hasRoutine ? formatSessionMeta(exerciseCount, estimatedDurationMin) : null;
  const ctaInverse = exerciseCount > 0;
  const ctaIcon = isCompleted ? (
    <ArrowRight size={18} aria-hidden="true" />
  ) : isRecoverable ? (
    <RotateCcw size={18} aria-hidden="true" />
  ) : (
    <Play size={18} aria-hidden="true" />
  );
  const ctaDisabled = rehydrating;
  const resolvedLabel = rehydrating ? "Preparando entrenamiento…" : ctaLabel;

  return (
    <section
      data-testid="training-hero-command"
      aria-label="Entrenamiento de hoy"
      className="relative overflow-hidden min-w-0"
      style={{
        borderRadius: 0,
        padding: 0,
        border: "none",
        background: "transparent",
        boxShadow: "none",
      }}
    >
      {/* Glow crimson superior sutil, sin interferir con la legibilidad. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[16px] left-1/2 -translate-x-1/2 w-[60vw] max-w-[600px] h-[260px]"
        style={{
          background: `radial-gradient(60% 40% at 50% 0%, ${ACCENT.glow}, transparent 70%)`,
          opacity: 0.35,
          filter: "blur(28px)",
          pointerEvents: "none",
        }}
      />

      <div className="relative grid grid-cols-[1fr_auto] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-8 lg:items-end">
        <div className="min-w-0 p-3 px-4 md:p-4 lg:p-6">
          <div className="flex items-center gap-2 flex-wrap">
            {!isCompleted ? <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: `${SPACE.xs} ${SPACE.sm}`,
                borderRadius: RADIUS.pill,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${GLASS.border}`,
                ...TYPE.label,
                color: TEXT.secondary,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              <Sparkles size={12} aria-hidden="true" />
              {isCompleted ? "✓ COMPLETADO HOY" : "⚡ HOY"}
            </span> : null}
            {focusLabel && hasRoutine && focusLabel.trim() !== routineTitle.trim() ? (
              <span style={{ ...TYPE.caption, color: TEXT.tertiary }}>
                Enfoque: <span style={{ color: TEXT.secondary, fontWeight: 600 }}>{focusLabel}</span>
              </span>
            ) : null}
          </div>

          <p style={{ ...TYPE.callout, color: TEXT.secondary, margin: `${SPACE.md} 0 0` }}>{greeting}</p>

          {isCompleted && completedSummary ? (
            <>
              <span className="mt-4 inline-flex rounded-full border border-[#30D158]/30 bg-[#30D158]/15 px-3 py-1 text-xs font-semibold text-[#30D158]">
                ✓ COMPLETADO HOY
              </span>
              <h1 className="mt-3 max-w-[14ch] text-[clamp(1.9rem,6vw,2.6rem)] font-bold leading-tight tracking-tight text-white">
                {completedSummary.title}
              </h1>
              <p className="mt-3 font-mono text-xs text-zinc-400">
                {completedSummary.durationMin} min · {completedSummary.exerciseCount} ejercicios
              </p>
            </>
          ) : hasRoutine ? (
            <>
              <h1
                style={{
                  ...TYPE.hero,
                  fontSize: "clamp(1.9rem, 6vw, 2.6rem)",
                  lineHeight: 1.04,
                  color: TEXT.primary,
                  margin: `${SPACE.sm} 0 0`,
                  wordBreak: "break-word",
                  letterSpacing: "-0.025em",
                  maxWidth: "14ch",
                }}
              >
                {routineTitle}
              </h1>
              {meta ? (
                <div style={{ marginTop: SPACE.md }}>
                  <span
                    style={{
                      ...TYPE.mono,
                      fontVariantNumeric: NUMERIC.transform,
                      color: TEXT.secondary,
                      fontSize: TYPE.caption.size,
                    }}
                  >
                    {meta}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h1
                style={{
                  ...TYPE.hero,
                  fontSize: "clamp(1.9rem, 6vw, 2.6rem)",
                  lineHeight: 1.04,
                  color: TEXT.primary,
                  margin: `${SPACE.sm} 0 0`,
                  letterSpacing: "-0.025em",
                }}
              >
                Rutina del día
              </h1>
              <p style={{ ...TYPE.subhead, color: TEXT.secondary, margin: `${SPACE.md} 0 0`, maxWidth: "42ch" }}>
                Crea tu primera rutina para empezar
              </p>
            </>
          )}

          <div
            className="w-full lg:w-auto"
            style={{
              marginTop: SPACE.xl,
              maxWidth: "100%",
              transition: reduce ? undefined : "transform 150ms ease",
            }}
          >
            <div className={isCompleted ? "flex items-center gap-2" : ""}>
              <GlassButton
                variant="primary"
                icon={ctaIcon}
                onClick={onPrimary}
                disabled={ctaDisabled}
                className="h-11 whitespace-nowrap rounded-xl px-5 font-semibold active:scale-[0.98] transition-transform w-full lg:w-auto"
              style={{
                minHeight: 52,
                fontSize: TYPE.subhead.size,
                fontWeight: 700,
                paddingInline: SPACE.xl,
                color: ctaInverse ? TEXT.primary : undefined,
                boxShadow: ctaDisabled ? "none" : `0 12px 30px ${ACCENT.glow}`,
              }}
              >
                {isCompleted ? "Ver progreso →" : resolvedLabel}
              </GlassButton>
              {isCompleted && onExtra ? (
                <button type="button" aria-label="Iniciar sesión extra" onClick={onExtra}
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl bg-[#2C2C2E] px-3 text-white active:scale-[0.98] transition-transform">
                  <Plus size={18} aria-hidden="true" />
                  <span className="sr-only">Extra</span>
                </button>
              ) : null}
            </div>
            {ctaDisabled && (
              <p
                style={{
                  ...TYPE.caption,
                  color: TEXT.tertiary,
                  margin: `${SPACE.xs} 0 0`,
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE.xs,
                }}
              >
                <span
                  aria-hidden="true"
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: ACCENT.base,
                    animation: !reduce ? `cronos-pulse ${MOTION.loop.session} infinite` : "none",
                  }}
                />
                {`${resolvedLabel}…`}
              </p>
            )}
          </div>
        </div>

        <div
          className="flex flex-col items-start gap-2 self-start lg:self-start"
          style={{ backgroundColor: "transparent" }}
        >
          <div
            data-testid="today-hero-muscle-map"
            aria-hidden="true"
            style={{ backgroundColor: "transparent" }}
          >
            <div
              style={{
                width: "100%",
                margin: "0 auto",
                backgroundColor: "transparent",
                height: 160,
              }}
            >
              <MuscleReadonlyMap
                counts={muscleCounts ?? new Map()}
                label="Torso anatómico"
                aspectRatio={isCompact ? 10 / 13 : 168 / 236}
                backgroundColor="transparent"
                inertFill="rgba(255, 255, 255, 0.1)"
                litFill={ACCENT.base}
                mostLitFill={ACCENT.base}
                caption={null}
                overflow="visible"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
