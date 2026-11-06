import { Trophy } from "lucide-react";
import { ACCENT, GLASS, SPACE, TEXT, TYPE } from "@/design/tokens";
import type { RecentPR } from "@/lib/dashboard/dashboardMetrics";

function formatPRDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function PRSection({ recentPRs, compact = false, className }: { recentPRs: readonly RecentPR[]; compact?: boolean; className?: string }) {
  const hasPrs = Boolean(recentPRs && recentPRs.length > 0);

  if (!hasPrs) {
    return (
      <section aria-label="Récords recientes" className={className} style={{ paddingBlock: SPACE.xs }}>
        <div className="flex items-center gap-2" style={{ marginBottom: SPACE.sm }}>
          <Trophy size={16} color={TEXT.tertiary} aria-hidden="true" />
          <span style={{ ...TYPE.subhead, color: TEXT.secondary }}>Récords recientes</span>
        </div>
        <p style={{ ...TYPE.body, color: TEXT.tertiary, margin: 0, maxWidth: "36ch" }}>
          Completa entrenamientos para ver tus mejores marcas aquí.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Récords recientes" className={className} style={{ paddingBlock: SPACE.xs }}>
      <div className="flex items-center gap-2" style={{ marginBottom: compact ? SPACE.xs : SPACE.md }}>
        <Trophy size={compact ? 14 : 16} color={ACCENT.base} aria-hidden="true" />
        <span style={{ ...TYPE.subhead, color: TEXT.primary }}>Récords recientes</span>
      </div>
      <div className="flex flex-col gap-1">
        {recentPRs.map((pr) => (
          <div
            key={`${pr.exerciseName}-${pr.achievedAt}`}
            className="flex items-start justify-between gap-3"
            style={{
              padding: `${compact ? SPACE.xs : SPACE.xs} 0`,
              borderTop: `1px solid ${GLASS.border}`,
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
                fontVariantNumeric: "tabular-nums",
                color: ACCENT.text,
                whiteSpace: "nowrap",
                fontSize: compact ? TYPE.caption.size : TYPE.subhead.size,
                fontWeight: 700,
              }}
              aria-label={`1RM estimado ${pr.estimated1RM} kilogramos`}
            >
              {pr.estimated1RM} kg
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
