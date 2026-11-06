import { WEEKDAY_SHORT_ES } from "@/lib/dashboard/heroCardModel";
import { ACCENT, GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import type { StreakStats, WeeklyPlanDay } from "@/lib/dashboard/dashboardMetrics";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface WeeklyProgressSectionProps {
  weeklyCompleted: number;
  weeklyGoal: number;
  weeklyPlan: readonly WeeklyPlanDay[] | undefined;
  streakStats?: StreakStats | null;
}

export function WeeklyProgressSection({
  weeklyCompleted,
  weeklyGoal,
  weeklyPlan,
  streakStats,
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
      style={{
        borderRadius: RADIUS.card,
        border: `1px solid ${GLASS.border}`,
        background: `linear-gradient(180deg, ${GLASS.fill} 0%, rgba(255,255,255,0.025) 100%)`,
        padding: SPACE.card,
      }}
    >
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p style={{ ...TYPE.label, color: TEXT.tertiary, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Esta semana
          </p>
          <p style={{ ...TYPE.subhead, color: TEXT.primary, margin: `${SPACE.xs} 0 0` }}>{progressLabel}</p>
          {streakLabel ? (
            <p style={{ ...TYPE.caption, color: ACCENT.text, margin: `${SPACE.xs} 0 0` }}>{streakLabel}</p>
          ) : null}
        </div>
      </div>

      <div
        role="img"
        aria-label={`Progreso semanal: ${weeklyCompleted} de ${weeklyGoal} entrenamientos completados`}
        className="grid grid-cols-7 gap-1.5 sm:gap-2"
      >
        {WEEKDAY_SHORT_ES.map((short, index) => {
          const day = weeklyPlan?.[index];
          const isToday = day?.isToday ?? false;
          const trained = day?.trained ?? false;
          const stateLabel = trained ? "completado" : isToday ? "hoy, pendiente" : "pendiente";
          return (
            <div
              key={short}
              title={day?.dayName}
              className="flex items-center justify-center"
              style={{
                minHeight: 44,
                minWidth: 0,
                borderRadius: RADIUS.round,
                color: trained ? TEXT.onAccent : isToday ? TEXT.primary : TEXT.tertiary,
                background: trained ? ACCENT.base : isToday ? ACCENT.subtle : "rgba(255,255,255,0.03)",
                border: `1px solid ${trained ? ACCENT.border : isToday ? GLASS.borderStrong : GLASS.border}`,
                boxShadow: trained ? `0 8px 18px ${ACCENT.glow}` : isToday ? `0 0 0 3px ${ACCENT.subtle}` : "none",
                fontSize: TYPE.caption.size,
                fontWeight: isToday || trained ? 700 : TYPE.caption.weight,
                transition: reduce ? undefined : "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
              }}
              aria-label={`${short}: ${stateLabel}`}
            >
              {short}
            </div>
          );
        })}
      </div>
    </section>
  );
}
