import type { FC } from "react";
import type { RecentSession } from "@/hooks/useGymData";
import { formatVolume } from "@/hooks/useGymData";
import { GLASS, RADIUS, SURFACE, SPACE, TEXT, TYPE } from "@/design/tokens";
import { PROGRESS_LABELS } from "@/lib/i18n";

export interface WorkoutHistoryProps {
  recent: RecentSession[];
}

function formatSessionDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(new Date(iso))
    .replace(".", "");
}

function fallbackSessionTitle(iso: string): string {
  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "long" })
    .format(new Date(iso));
  const name = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return PROGRESS_LABELS.sessionFallback(name);
}

const rowStyle: React.CSSProperties = {
  backgroundColor: SURFACE.l1,
  border: `1px solid ${GLASS.border}`,
  borderRadius: RADIUS.card,
  padding: SPACE.lg,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.md,
};

const titleStyle: React.CSSProperties = {
  fontSize: TYPE.headline.size,
  lineHeight: TYPE.headline.lineHeight,
  fontWeight: TYPE.headline.weight,
  color: TEXT.primary,
  minWidth: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  fontWeight: TYPE.caption.weight,
  color: TEXT.tertiary,
};

const volumeStyle: React.CSSProperties = {
  fontSize: TYPE.mono.size,
  lineHeight: TYPE.mono.lineHeight,
  fontWeight: TYPE.mono.weight,
  fontFamily: TYPE.mono.font,
  letterSpacing: TYPE.mono.tracking,
  color: TEXT.primary,
  fontVariantNumeric: "tabular-nums",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: TYPE.subhead.size,
  lineHeight: TYPE.subhead.lineHeight,
  fontWeight: TYPE.subhead.weight,
  letterSpacing: TYPE.subhead.tracking,
  color: TEXT.primary,
  textTransform: "uppercase",
  marginBottom: SPACE.md,
};

export const WorkoutHistory: FC<WorkoutHistoryProps> = ({ recent }) => {
  const sessions = recent.filter((session) => session.sets > 0 || session.volume > 0);

  return (
    <div>
      <h3 style={sectionTitleStyle}>{PROGRESS_LABELS.history}</h3>
      {sessions.length === 0 ? (
        <p style={{ ...subtitleStyle, color: TEXT.secondary }}>
          {PROGRESS_LABELS.historyEmpty}
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} style={rowStyle} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate" style={titleStyle}>
                  {session.routineTitle || fallbackSessionTitle(session.started_at)}
                </p>
                <p style={subtitleStyle}>
                  {formatSessionDate(session.started_at)} ·{" "}
                  {PROGRESS_LABELS.sessionSets(session.sets)}
                </p>
              </div>
              <span style={volumeStyle}>{formatVolume(session.volume)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkoutHistory;
