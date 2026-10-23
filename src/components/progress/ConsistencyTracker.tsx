import type { FC } from "react";
import { Activity } from "lucide-react";
import type { WeekPoint } from "@/hooks/useGymData";
import { GlassCard } from "@/components/ui";
import { ACCENT, TEXT, TYPE } from "@/design/tokens";
import { PROGRESS_LABELS } from "@/lib/i18n";

export interface ConsistencyTrackerProps {
  week: WeekPoint[];
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: TYPE.subhead.size,
  lineHeight: TYPE.subhead.lineHeight,
  fontWeight: TYPE.subhead.weight,
  color: TEXT.primary,
};

const countStyle: React.CSSProperties = {
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  fontWeight: TYPE.caption.weight,
  color: TEXT.tertiary,
};

const dayLabelStyle: React.CSSProperties = {
  ...countStyle,
  textTransform: "capitalize",
};

export const ConsistencyTracker: FC<ConsistencyTrackerProps> = ({ week }) => {
  const peak = Math.max(1, ...week.map((point) => point.count));

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4" style={{ color: ACCENT.text }} />
        <h3 style={sectionTitleStyle}>{PROGRESS_LABELS.week}</h3>
      </div>
      <div className="flex h-40 items-end gap-2">
        {week.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
            <span style={countStyle}>{point.count || ""}</span>
            <div
              className={`w-full rounded-t-xl border-t border-red-400 transition-all ${
                point.count > 0
                  ? "bg-gradient-to-t from-red-500/20 to-red-500"
                  : "bg-white/5"
              }`}
              style={{ height: `${Math.max(4, (point.count / peak) * 120)}px` }}
            />
            <span style={dayLabelStyle}>{point.label}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default ConsistencyTracker;
