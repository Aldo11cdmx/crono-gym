import type { FC } from "react";
import { Award, CalendarDays, Dumbbell, TrendingUp } from "lucide-react";
import { formatVolume, formatWeight, type ProgressStats } from "@/hooks/useGymData";
import { GlassCard } from "@/components/ui";
import { ACCENT, SPACE, TEXT, TYPE } from "@/design/tokens";
import { PROGRESS_LABELS } from "@/lib/i18n";

export interface ProgressChartsProps {
  stats: ProgressStats;
}

const labelStyle: React.CSSProperties = {
  fontSize: TYPE.label.size,
  lineHeight: TYPE.label.lineHeight,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.secondary,
  textTransform: "uppercase",
};

const valueStyle: React.CSSProperties = {
  fontSize: TYPE.mono.size,
  lineHeight: TYPE.mono.lineHeight,
  fontWeight: TYPE.mono.weight,
  fontFamily: TYPE.mono.font,
  letterSpacing: TYPE.mono.tracking,
  color: TEXT.primary,
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={<CalendarDays className="h-4 w-4" style={{ color: ACCENT.text }} />}
        label={PROGRESS_LABELS.metrics.workouts}
        value={String(stats.workoutsThisMonth)}
        hint={PROGRESS_LABELS.hints.thisMonth}
      />
      <MetricCard
        icon={<Award className="h-4 w-4" style={{ color: ACCENT.text }} />}
        label={PROGRESS_LABELS.metrics.bestWeight}
        value={formatWeight(stats.bestWeight)}
        hint={PROGRESS_LABELS.hints.validSet}
      />
      <MetricCard
        icon={<Dumbbell className="h-4 w-4" style={{ color: ACCENT.text }} />}
        label={PROGRESS_LABELS.metrics.volume}
        value={formatVolume(stats.monthlyVolume)}
        hint={PROGRESS_LABELS.hints.thisMonth}
      />
      <MetricCard
        icon={<TrendingUp className="h-4 w-4" style={{ color: ACCENT.text }} />}
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
    <GlassCard className="hover:border-white/20">
      <div className="flex items-center gap-2">
        {icon}
        <p style={labelStyle}>{label}</p>
      </div>
      <p style={{ ...valueStyle, marginTop: SPACE.md }}>{value}</p>
      <p style={hintStyle}>{hint}</p>
    </GlassCard>
  );
}

export default ProgressCharts;
