/**
 * WeeklyGoalCard.tsx — the weekly plan progress panel.
 *
 * Shows a 7-day bar strip (Mon–Sun, local time), a progress count against the
 * session goal, and a delta when the week is ahead of or behind schedule.
 */

import { DashboardCard } from "./DashboardCard";
import type { WeeklyProgress } from "@/lib/dashboard/dashboardMetrics";
import { ACCENT, GLASS, MOTION, STATUS, TEXT, TYPE } from "@/design/tokens";

export interface WeeklyGoalCardProps {
  loading?: boolean;
  progress: WeeklyProgress | null;
  /** Day labels in local calendar order (Mon first). */
  dayLabels?: [string, string, string, string, string, string, string];
}

const DEFAULT_DAYS: [string, string, string, string, string, string, string] = [
  "L", "M", "X", "J", "V", "S", "D",
];

export function WeeklyGoalCard({
  loading = false,
  progress,
  dayLabels = DEFAULT_DAYS,
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

        {/* Day strip */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "4px",
            height: "60px",
          }}
        >
          {daysTrained.map((trained, i) => {
            const height = trained ? "60%" : "12%";
            return (
              <div
                key={dayLabels[i]}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height,
                    borderRadius: "4px 4px 0 0",
                    background: trained ? ACCENT.base : GLASS.fill,
                    transition: `height ${MOTION.normal} ${MOTION.easeOut}`,
                  }}
                />
                <span
                  style={{
                    fontSize: TYPE.caption.size,
                    color: trained ? TEXT.primary : TEXT.tertiary,
                  }}
                >
                  {dayLabels[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardCard>
  );
}
