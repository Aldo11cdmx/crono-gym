import { History } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SPACE, TEXT, TYPE, ACCENT } from "@/design/tokens";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";

export interface HistorySectionProps {
  sessions: readonly DashboardSession[];
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function sessionDurationLabel(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const mins = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 60_000);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  return `${mins} min`;
}

export function HistorySection({ sessions }: HistorySectionProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <GlassCard raised style={{ padding: SPACE.card, minHeight: 132 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: SPACE.sm }}>
          <History size={18} color={TEXT.tertiary} aria-hidden="true" />
          <span style={{ ...TYPE.subhead, color: TEXT.secondary }}>Historial reciente</span>
        </div>
        <p style={{ ...TYPE.body, color: TEXT.tertiary, margin: 0 }}>
          Cuando completes sesiones, verás aquí tu actividad más reciente.
        </p>
      </GlassCard>
    );
  }
  return (
    <GlassCard raised style={{ padding: SPACE.card }}>
      <div className="flex items-center gap-2" style={{ marginBottom: SPACE.md }}>
        <History size={18} color={ACCENT.base} aria-hidden="true" />
        <span style={{ ...TYPE.subhead, color: TEXT.primary }}>Historial reciente</span>
      </div>
      <div className="flex flex-col" style={{ gap: SPACE.xs }}>
        {sessions.map((s) => {
          const duration = sessionDurationLabel(s.startedAt, s.completedAt);
          const sets = s.sets.filter((set) => !set.isWarmup).length;
          return (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3"
              style={{
                padding: `${SPACE.sm} 0`,
                borderBottom: `1px solid ${ACCENT.muted}`,
              }}
            >
              <div className="min-w-0">
                <p style={{ ...TYPE.body, color: TEXT.primary, margin: 0, wordBreak: "break-word" }}>
                  {s.routineTitle?.trim() || "Sesión"}
                </p>
                <p style={{ ...TYPE.caption, color: TEXT.tertiary, margin: 0 }}>
                  {formatSessionDate(s.startedAt)}
                  {duration ? ` · ${duration}` : ""}
                  {sets > 0 ? ` · ${sets} series` : ""}
                </p>
              </div>
              <span
                style={{
                  ...TYPE.caption,
                  color: s.completedAt ? TEXT.secondary : TEXT.tertiary,
                  whiteSpace: "nowrap",
                }}
              >
                {s.completedAt ? "Completada" : "Incompleta"}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
