/**
 * WeeklyGoalCard.tsx — the weekly plan progress panel.
 *
 * Shows a 7-day bar strip (Mon–Sun, local time), a progress count against the
 * session goal, and a delta when the week is ahead of or behind schedule.
 *
 * When `planDays` is provided, each day in the strip also renders the routine's
 * day label (e.g. "Pecho") — syncing the plan with the routine library. Today is
 * highlighted; rest days (where the athlete trained) read as completed.
 */

import { DashboardCard } from "./DashboardCard";
import type { WeeklyProgress, WeeklyPlanDay } from "@/lib/dashboard/dashboardMetrics";
import { ACCENT, GLASS, MOTION, RADIUS, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";

export interface WeeklyGoalCardProps {
  loading?: boolean;
  progress: WeeklyProgress | null;
  /** Day labels in local calendar order (Mon first). */
  dayLabels?: [string, string, string, string, string, string, string];
  /** Optional daily plan info for syncing routine day labels. */
  planDays?: WeeklyPlanDay[] | null;
}

const DEFAULT_DAYS: [string, string, string, string, string, string, string] = [
  "L", "M", "X", "J", "V", "S", "D",
];

export function WeeklyGoalCard({
  loading = false,
  progress,
  dayLabels = DEFAULT_DAYS,
  planDays,
}: WeeklyGoalCardProps) {
  if (loading || !progress) {
    return (
      <DashboardCard title="Esta semana" loading>
        <></>
      </DashboardCard>
    );
  }

  const { completed, goal, daysTrained } = progress;
  const pct = Math.min(100, Math.round((completed / goal) * 100));
  const over = completed - goal;

  let deltaLabel = "";
  let deltaColor: string = TEXT.tertiary;
  if (over > 0) {
    deltaLabel = `+${over} sesión${over > 1 ? "es" : ""} extra${over > 1 ? "s" : ""}`;
    deltaColor = STATUS.success.text;
  } else if (over < 0) {
    deltaLabel = `${Math.abs(over)} sesión${over < -1 ? "es" : ""} falt${over < -1 ? "an" : "a"}`;
    deltaColor = STATUS.warning.text;
  } else if (over === 0 && completed > 0) {
    deltaLabel = "Meta alcanzada";
    deltaColor = STATUS.success.text;
  }

  return (
    <DashboardCard title="Esta semana">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "8px",
              borderRadius: "4px",
              background: GLASS.fill,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: ACCENT.base,
                transition: `width ${MOTION.normal} ${MOTION.easeOut}`,
              }}
            />
          </div>
          <div
            style={{
              fontSize: TYPE.mono.size,
              fontWeight: TYPE.mono.weight,
              color: TEXT.primary,
              minWidth: "48px",
              textAlign: "right",
            }}
          >
            {completed}/{goal}
          </div>
        </div>

        {deltaLabel && (
          <div
            style={{
              fontSize: TYPE.caption.size,
              color: deltaColor,
            }}
          >
            {deltaLabel}
          </div>
        )}

        {/* Day strip — compact pills with tooltip labels */}
        <div
          style={{
            display: "flex",
            gap: SPACE.sm,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: SPACE.sm,
          }}
        >
          {dayLabels.map((letter, i) => {
            const planDay = planDays?.[i];
            const isToday = planDay?.isToday ?? false;
            const dayLabel = planDay?.dayLabel ?? null;
            const trained = daysTrained[i];

            const bg = isToday
              ? ACCENT.base
              : trained
                ? GLASS.fillRaised
                : GLASS.fill;
            const border = isToday ? ACCENT.border : GLASS.border;
            const color = isToday
              ? TEXT.inverse
              : trained
                ? TEXT.primary
                : TEXT.tertiary;

            return (
              <span
                key={letter}
                title={dayLabel ?? undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: RADIUS.round,
                  fontSize: TYPE.caption.size,
                  fontWeight: isToday ? TYPE.caption.weight : undefined,
                  color,
                  background: bg,
                  border: `1px solid ${border}`,
                  boxShadow: isToday ? ACCENT.ring : undefined,
                }}
              >
                {letter}
              </span>
            );
          })}
        </div>
      </div>
    </DashboardCard>
  );
}
