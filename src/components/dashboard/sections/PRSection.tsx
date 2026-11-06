import { Trophy } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  ACCENT,
  SPACE,
  TEXT,
  TYPE,
} from "@/design/tokens";
import type { RecentPR } from "@/lib/dashboard/dashboardMetrics";

export interface PRSectionProps {
  recentPRs: readonly RecentPR[];
}

function formatPRDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function PRSection({ recentPRs }: PRSectionProps) {
  if (!recentPRs || recentPRs.length === 0) {
    return (
      <GlassCard raised style={{ padding: SPACE.card, minHeight: 132 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: SPACE.sm }}>
          <Trophy size={18} color={TEXT.tertiary} aria-hidden="true" />
          <span style={{ ...TYPE.subhead, color: TEXT.secondary }}>Récords recientes</span>
        </div>
        <p style={{ ...TYPE.body, color: TEXT.tertiary, margin: 0 }}>
          Aún no hay récords en los últimos 7 días. Completa entrenamientos para ver tus mejores marcas aquí.
        </p>
      </GlassCard>
    );
  }
  return (
    <GlassCard raised style={{ padding: SPACE.card }}>
      <div className="flex items-center gap-2" style={{ marginBottom: SPACE.md }}>
        <Trophy size={18} color={ACCENT.base} aria-hidden="true" />
        <span style={{ ...TYPE.subhead, color: TEXT.primary }}>Récords recientes</span>
      </div>
      <div className="flex flex-col" style={{ gap: SPACE.sm }}>
        {recentPRs.map((pr) => (
          <div
            key={`${pr.exerciseName}-${pr.achievedAt}`}
            className="flex items-start justify-between gap-3"
            style={{
              padding: `${SPACE.sm} 0`,
              borderBottom: `1px solid ${ACCENT.muted}`,
            }}
          >
            <div className="min-w-0">
              <p style={{ ...TYPE.body, color: TEXT.primary, margin: 0, wordBreak: "break-word" }}>
                {pr.exerciseName}
              </p>
              <p style={{ ...TYPE.caption, color: TEXT.tertiary, margin: 0 }}>
                {formatPRDate(pr.achievedAt)}
              </p>
            </div>
            <span
              style={{
                ...TYPE.mono,
                color: ACCENT.text,
                whiteSpace: "nowrap",
                fontSize: TYPE.subhead.size,
              }}
              aria-label={`1RM estimado ${pr.estimated1RM} kilogramos`}
            >
              {pr.estimated1RM} kg
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
