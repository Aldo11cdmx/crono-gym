import { History } from "lucide-react";
import { Link } from "react-router-dom";
import { ACCENT, GLASS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { PROGRESS_PATH } from "@/components/shell/navItems";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";

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

const MAX_VISIBLE = 4;

export function HistorySection({
  sessions,
  className,
  maxVisible = MAX_VISIBLE,
}: { sessions: readonly DashboardSession[]; className?: string; maxVisible?: number }) {
  const visible = sessions.slice(0, maxVisible);
  const hasMore = sessions.length > maxVisible;

  if (!sessions || sessions.length === 0) {
    return (
        <section aria-label="Historial reciente" className={className} style={{ paddingBlock: SPACE.xs }}>
        <div className="flex items-center gap-2" style={{ marginBottom: SPACE.sm }}>
          <History size={16} color={TEXT.tertiary} aria-hidden="true" />
          <span style={{ ...TYPE.subhead, color: TEXT.secondary }}>Historial reciente</span>
        </div>
        <p style={{ ...TYPE.body, color: TEXT.tertiary, margin: 0, maxWidth: "36ch" }}>
          Cuando completes sesiones, verás aquí tu actividad más reciente.
        </p>
      </section>
    );
  }
  const seeAllLink = hasMore ? (
    <Link
      to={PROGRESS_PATH}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: SPACE.xs,
        marginTop: SPACE.sm,
        color: TEXT.secondary,
        textDecoration: "none",
        fontSize: TYPE.caption.size,
      }}
    >
      Ver progreso completo
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 0,
          height: 0,
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderBottom: "6px solid currentColor",
          marginLeft: 2,
        }}
      />
    </Link>
  ) : null;

  return (
    <section aria-label="Historial reciente" className={className} style={{ paddingBlock: SPACE.xs }}>
    <div className="flex items-center gap-2" style={{ marginBottom: SPACE.md }}>
      <History size={16} color={ACCENT.base} aria-hidden="true" />
      <span style={{ ...TYPE.subhead, color: TEXT.primary }}>Historial reciente</span>
    </div>
    <div className="flex flex-col gap-1">
      {visible.map((s) => {
        const duration = sessionDurationLabel(s.startedAt, s.completedAt);
        const workingSets = s.sets.filter((set) => !set.isWarmup).length;
        return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3"
              style={{
                padding: "4px 0",
                borderTop: `1px solid ${GLASS.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div className="min-w-0" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <p style={{ ...TYPE.body, color: TEXT.primary, margin: 0, wordBreak: "break-word" }}>
                  {s.routineTitle?.trim() || "Sesión"}
                </p>
                <span
                  style={{
                    ...TYPE.caption,
                    color: TEXT.tertiary,
                    margin: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatSessionDate(s.startedAt)}
                  {duration ? ` · ` : null}
                  {duration ? (
                    <span
                      style={{
                        ...TYPE.mono,
                        fontVariantNumeric: "tabular-nums",
                        color: TEXT.secondary,
                      }}
                    >
                      {duration}
                    </span>
                  ) : null}
                  {workingSets > 0 ? ` · ${workingSets} series` : ""}
                </span>
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
    {seeAllLink}
  </section>
  );
}
