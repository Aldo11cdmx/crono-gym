import type { FC } from "react";
import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import type { WeekPoint } from "@/hooks/useGymData";
import { ACCENT, GLASS, RADIUS, SURFACE, SPACE, TEXT, TYPE } from "@/design/tokens";
import { PROGRESS_LABELS } from "@/lib/i18n";

export interface ConsistencyTrackerProps {
  week: WeekPoint[];
}

const TIMEFRAME_OPTIONS = [
  { value: "7d", label: "7D" },
  { value: "4s", label: "4S" },
] as const;

const cardStyle: React.CSSProperties = {
  backgroundColor: SURFACE.l1,
  border: `1px solid ${GLASS.border}`,
  borderRadius: RADIUS.card,
  padding: SPACE.lg,
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.xs,
  backgroundColor: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  borderRadius: "9999px",
  padding: `${SPACE.xs} ${SPACE.sm}`,
};

const pillButtonStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 28,
  height: 28,
  borderRadius: "9999px",
  border: "none",
  background: active ? ACCENT.base : "transparent",
  color: active ? TEXT.onAccent : TEXT.tertiary,
  fontSize: TYPE.caption.size,
  fontWeight: 700,
  cursor: "pointer",
});

const sectionTitleStyle: React.CSSProperties = {
  fontSize: TYPE.subhead.size,
  lineHeight: TYPE.subhead.lineHeight,
  fontWeight: TYPE.subhead.weight,
  letterSpacing: TYPE.subhead.tracking,
  color: TEXT.primary,
  textTransform: "uppercase",
  marginBottom: SPACE.md,
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
  const [timeframe, setTimeframe] = useState<"7d" | "4s">("7d");

  const displayWeek = useMemo(() => {
    if (timeframe === "4s") {
      return week.slice(0, 4).map((point, i) => ({
        ...point,
        label: `S${i + 1}`,
      }));
    }
    return week;
  }, [week, timeframe]);

  const displayPeak = Math.max(1, ...displayWeek.map((point) => point.count));

  return (
    <div style={cardStyle} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: ACCENT.text }} />
          <h3 style={sectionTitleStyle}>{PROGRESS_LABELS.week}</h3>
        </div>
        <div style={pillStyle} role="radiogroup" aria-label="Periodo de tiempo">
          {TIMEFRAME_OPTIONS.map((option) => {
            const active = option.value === timeframe;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTimeframe(option.value as "7d" | "4s")}
                style={pillButtonStyle(active)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex h-40 items-end gap-2">
        {displayWeek.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
            <span style={countStyle}>{point.count || ""}</span>
            <div
              className={`w-full rounded-t-xl transition-all ${
                point.count > 0
                  ? "bg-gradient-to-t from-red-500/20 to-red-500"
                  : "bg-white/5"
              }`}
              style={{ height: `${Math.max(4, (point.count / displayPeak) * 120)}px` }}
            />
            <span style={dayLabelStyle}>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConsistencyTracker;
