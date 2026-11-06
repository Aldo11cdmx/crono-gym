import { Check } from "lucide-react";

import { WEEKDAY_SHORT_ES } from "@/lib/dashboard/heroCardModel";
import { ACCENT, GLASS, RADIUS, SPACE, TEXT, TYPE, NUMERIC } from "@/design/tokens";
import type { StreakStats, WeeklyPlanDay } from "@/lib/dashboard/dashboardMetrics";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface WeeklyProgressSectionProps {
  weeklyCompleted: number;
  weeklyGoal: number;
  weeklyPlan: readonly WeeklyPlanDay[] | undefined;
  streakStats?: StreakStats | null;
  className?: string;
}

export function WeeklyProgressSection({
  weeklyCompleted,
  weeklyGoal,
  weeklyPlan,
  streakStats,
  className,
}: WeeklyProgressSectionProps) {
  const reduce = useReducedMotion();
  const safeGoal = weeklyGoal > 0 ? weeklyGoal : 7;
  const progressLabel = `${weeklyCompleted}/${safeGoal} completados`;
  const streakLabel =
    streakStats && streakStats.currentDays > 0
      ? `Racha: ${streakStats.currentDays} día${streakStats.currentDays === 1 ? "" : "s"}`
      : null;

  return (
    <section
      data-testid="weekly-pulse-line"
      aria-label="Esta semana"
      className={className}
      style={{
        padding: 0,
        background: "transparent",
      }}
    >
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p style={{ ...TYPE.label, color: TEXT.tertiary, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Esta semana
          </p>
          <p style={{ ...TYPE.subhead, color: TEXT.primary, margin: `${SPACE.xs} 0 0`, fontVariantNumeric: NUMERIC.transform }}>
            {progressLabel}
          </p>
          {streakLabel ? (
            <p style={{ ...TYPE.caption, color: ACCENT.text, margin: `${SPACE.xs} 0 0` }}>{streakLabel}</p>
          ) : null}
        </div>
      </div>

      <div
        role="img"
        aria-label={`Progreso semanal: ${weeklyCompleted} de ${weeklyGoal} entrenamientos completados`}
        className="flex w-full"
        style={{
          borderRadius: RADIUS.surface,
          overflow: "hidden",
          border: `1px solid ${GLASS.border}`,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {WEEKDAY_SHORT_ES.map((short, index) => {
          const day = weeklyPlan?.[index];
          const isToday = day?.isToday ?? false;
          const trained = day?.trained ?? false;
          const isLast = index === WEEKDAY_SHORT_ES.length - 1;
          return (
            <div
              key={short}
              title={day?.dayName}
              aria-label={`${short}: ${trained ? "completado" : isToday ? "hoy, pendiente" : "pendiente"}`}
              className="flex-1 min-w-0 flex items-stretch justify-center"
              style={{
                minHeight: 44,
                borderRight: isLast ? "none" : `1px solid ${GLASS.border}`,
                background: trained ? ACCENT.base : isToday ? ACCENT.subtle : "transparent",
                color: trained ? TEXT.onAccent : isToday ? TEXT.primary : TEXT.tertiary,
                boxShadow: isToday && !trained ? `inset 0 0 0 1px ${ACCENT.border}` : "none",
                transition: reduce ? undefined : "background-color 150ms ease, color 150ms ease",
              }}
            >
              <span
                aria-hidden="true"
                className="flex items-center justify-center gap-0.5 w-full"
                style={{
                  minHeight: 44,
                  fontSize: TYPE.caption.size,
                  fontWeight: isToday || trained ? 700 : TYPE.caption.weight,
                  letterSpacing: trained ? "-0.01em" : undefined,
                }}
              >
                {trained ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
                <span>{short}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
