import { useElapsedMs, formatElapsed } from "@/hooks/useElapsedMs";
import { GymSettingsTrigger } from "./workout/GymSettingsTrigger";
import { SPACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";

export interface ActiveWorkoutHeaderProps {
  /** Short label like "3/4 Sentadilla". */
  exerciseLabel: string;
  /** ISO timestamp the session began, for the elapsed-time display. */
  startedAt: string | null | undefined;
}

export function ActiveWorkoutHeader({
  exerciseLabel,
  startedAt,
}: ActiveWorkoutHeaderProps) {
  const elapsed = useElapsedMs(startedAt);
  const time = formatElapsed(elapsed);

  return (
    <div
      style={{
        position: "fixed",
        top: SPACE.lg,
        left: 0,
        right: 0,
        zIndex: Z_INDEX.pill,
        margin: "0 auto",
        maxWidth: "560px",
        padding: `0 ${SPACE.gutter}`,
      }}
    >
      <div
        className="backdrop-blur-xl bg-neutral-950/95 border border-neutral-50/10 rounded-full px-4 py-2 shadow-xl"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: SPACE.sm,
        }}
      >
        <span
          style={{
            fontSize: TYPE.subhead.size,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: TEXT.secondary,
          }}
        >
          {exerciseLabel}
        </span>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE.sm,
          }}
        >
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
            }}
          >
            {time}
          </span>
          <GymSettingsTrigger />
        </div>
      </div>
    </div>
  );
}
