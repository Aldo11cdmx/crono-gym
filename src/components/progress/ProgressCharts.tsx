import type { FC } from "react";
import { Award, CalendarDays, Dumbbell, TrendingUp } from "lucide-react";
import { formatVolume, formatWeight, type ProgressStats } from "@/hooks/useGymData";
import { ACCENT, GLASS, RADIUS, SURFACE, SPACE, TEXT, TYPE } from "@/design/tokens";
import { PROGRESS_LABELS } from "@/lib/i18n";

export interface ProgressChartsProps {
  stats: ProgressStats;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: SURFACE.l1,
  border: `1px solid ${GLASS.border}`,
  borderRadius: RADIUS.card,
  padding: SPACE.lg,
};

const labelStyle: React.CSSProperties = {
  fontSize: TYPE.label.size,
  lineHeight: TYPE.label.lineHeight,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.tertiary,
  textTransform: "uppercase",
};

const valueStyle: React.CSSProperties = {
  fontFamily: TYPE.mono.font,
  fontSize: TYPE.title2.size,
  fontWeight: 700,
  letterSpacing: TYPE.mono.tracking,
  color: TEXT.primary,
  fontVariantNumeric: "tabular-nums",
  marginTop: SPACE.md,
};

const hintStyle: React.CSSProperties = {
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  fontWeight: TYPE.caption.weight,
  color: TEXT.tertiary,
  marginTop: SPACE.sm,
};

export const ProgressCharts: FC<ProgressChartsProps> = ({ stats }) => {
  return (
    <div className="grid gap-3 grid-cols-2">
      <MetricCard
        icon={<CalendarDays className="h-4 w-4 shrink-0" style={{ color: ACCENT.text }} />}
        label={PROGRESS_LABELS.metrics.workouts}
        value={String(stats.workoutsThisMonth)}
        hint={PROGRESS_LABELS.hints.thisMonth}
      />
      <MetricCard
        icon={<Award className="h-4 w-4 shrink-0" style={{ color: ACCENT.text }} />}
        label={PROGRESS_LABELS.metrics.bestWeight}
        value={formatWeight(stats.bestWeight)}
        hint={PROGRESS_LABELS.hints.validSet}
      />
      <MetricCard
        icon={<Dumbbell className="h-4 w-4 shrink-0" style={{ color: ACCENT.text }} />}
        label={PROGRESS_LABELS.metrics.volume}
        value={formatVolume(stats.monthlyVolume)}
        hint={PROGRESS_LABELS.hints.thisMonth}
      />
      <MetricCard
        icon={<TrendingUp className="h-4 w-4 shrink-0" style={{ color: ACCENT.text }} />}
        label={PROGRESS_LABELS.metrics.total}
        value={String(stats.totalWorkouts)}
        hint={PROGRESS_LABELS.hints.completed}
      />
    </div>
  );
};

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div style={cardStyle} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <p style={labelStyle}>{label}</p>
      </div>
      <p style={valueStyle}>{value}</p>
      <p style={hintStyle}>{hint}</p>
    </div>
  );
}

export default ProgressCharts;
