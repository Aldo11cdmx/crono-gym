import { ArrowRight, Play, RotateCcw, Sparkles } from "lucide-react";

import { GlassButton } from "@/components/ui/GlassButton";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { formatSessionMeta } from "@/lib/dashboard/heroCardModel";
import { ACCENT, GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
}: TrainingHeroSectionProps) {
  const reduce = useReducedMotion();
  const meta = hasRoutine ? formatSessionMeta(exerciseCount, estimatedDurationMin) : null;
  const ctaIcon = isCompleted ? (
    <ArrowRight size={18} aria-hidden="true" />
  ) : isRecoverable ? (
    <RotateCcw size={18} aria-hidden="true" />
  ) : (
    <Play size={18} aria-hidden="true" />
  );
  const ctaDisabled = rehydrating;

  return (
    <section
      data-testid="training-hero-command"
      aria-label="Entrenamiento de hoy"
      className="relative overflow-hidden"
      style={{
        borderRadius: RADIUS.card,
        padding: 0,
        border: `1px solid ${GLASS.border}`,
        background: `radial-gradient(120% 95% at 50% 0%, ${ACCENT.muted} 0%, rgba(16,16,16,0.97) 36%, rgba(8,8,8,0.99) 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.35)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(58% 48% at 50% 14%, ${ACCENT.glow} 0%, transparent 74%)`,
          opacity: 0.5,
        }}
      />

      <div className="relative flex flex-col lg:grid lg:items-end lg:grid-cols-[minmax(0,1.12fr)_minmax(220px,0.58fr)]">
        <div className="min-w-0 p-5 md:p-7 lg:p-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span
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
              Hoy
            </span>
            {focusLabel && hasRoutine && focusLabel.trim() !== routineTitle.trim() ? (
              <span style={{ ...TYPE.caption, color: TEXT.tertiary }}>
                Enfoque: <span style={{ color: TEXT.secondary, fontWeight: 600 }}>{focusLabel}</span>
              </span>
            ) : null}
          </div>

          <p style={{ ...TYPE.callout, color: TEXT.secondary, margin: `${SPACE.md} 0 0` }}>{greeting}</p>

          {hasRoutine ? (
            <>
              <h1
                style={{
                  ...TYPE.display,
                  fontSize: "clamp(2.15rem, 5vw, 3.35rem)",
                  lineHeight: 1.02,
                  color: TEXT.primary,
                  margin: `${SPACE.sm} 0 0`,
                  wordBreak: "break-word",
                  letterSpacing: "-0.035em",
                  maxWidth: "14ch",
                }}
              >
                {routineTitle}
              </h1>
              <p style={{ ...TYPE.title2, color: TEXT.secondary, margin: `${SPACE.md} 0 0` }}>{meta}</p>
            </>
          ) : (
            <>
              <h1
                style={{
                  ...TYPE.display,
                  fontSize: "clamp(2.15rem, 5vw, 3.35rem)",
                  lineHeight: 1.02,
                  color: TEXT.primary,
                  margin: `${SPACE.sm} 0 0`,
                  letterSpacing: "-0.035em",
                }}
              >
                Rutina del día
              </h1>
              <p style={{ ...TYPE.subhead, color: TEXT.secondary, margin: `${SPACE.md} 0 0`, maxWidth: "42ch" }}>
                Crea tu primera rutina para empezar
              </p>
            </>
          )}

          <div style={{ marginTop: SPACE.xl, width: "100%", maxWidth: 460, transition: reduce ? undefined : "transform 150ms ease" }}>
            <GlassButton
              variant="primary"
              block
              icon={ctaIcon}
              onClick={onPrimary}
              disabled={ctaDisabled}
              style={{
                minHeight: 52,
                fontSize: TYPE.subhead.size,
                fontWeight: 700,
                boxShadow: ctaDisabled ? "none" : `0 12px 30px ${ACCENT.glow}`,
              }}
            >
              {ctaLabel}
            </GlassButton>
          </div>
        </div>

        <div
          className="flex items-end justify-center lg:justify-end"
          style={{
            padding: "0 20px 20px",
            minHeight: hasRoutine ? 240 : 0,
          }}
        >
          <div
            data-testid="today-hero-muscle-map"
            aria-hidden="true"
            style={{
              width: "min(100%, 280px)",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${GLASS.border}`,
              padding: "12px 10px 8px",
            }}
          >
            <p
              style={{
                ...TYPE.caption,
                color: TEXT.tertiary,
                margin: `0 0 ${SPACE.xs}`,
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Enfoque muscular
            </p>
            <div style={{ width: 168, height: 236, margin: "0 auto", opacity: 0.96 }}>
              <MuscleReadonlyMap
                counts={hasRoutine && muscleCounts ? muscleCounts : new Map()}
                idleHint={"Elige una rutina para ver los músculos que trabajarás"}
                label="Torso anatómico"
                aspectRatio={168 / 236}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
