/**
 * DynamicIsland.tsx — the floating bar that lives at the top of the workout.
 *
 * A compact pill that is always visible: session time, current exercise, set
 * progress. Tapping it expands to global stats and a pause/end control,
 * without blocking the carousel.
 */

import { useState } from "react";
import { X } from "lucide-react";
import {
  formatElapsed,
  useElapsedMs,
} from "@/hooks/useElapsedMs";
import {
  DANGER,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SPACE,
  STATUS,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";

export interface DynamicIslandProps {
  /** ISO timestamp from ActiveSessionContext. The single tick source. */
  startedAt: string | null | undefined;
  /** Name of the currently selected exercise. */
  exerciseName?: string;
  /** Sets completed in the current exercise. */
  completedSets?: number;
  /** Total sets in the current exercise. */
  totalSets?: number;
  /** Sets completed in the whole session. */
  sessionDone?: number;
  /** Total sets in the whole session. */
  sessionTotal?: number;
  onEnd?: () => void;
}

export function DynamicIsland({
  startedAt,
  exerciseName,
  completedSets = 0,
  totalSets = 0,
  sessionDone = 0,
  sessionTotal = 0,
  onEnd,
}: DynamicIslandProps) {
  const elapsed = useElapsedMs(startedAt);
  const time = formatElapsed(elapsed);

  const [expanded, setExpanded] = useState(false);

  const setProgressText =
    totalSets > 0 ? `${completedSets}/${totalSets} series` : undefined;
  const sessionProgressText =
    sessionTotal > 0 ? `${sessionDone}/${sessionTotal} series` : undefined;

  const shortExercise = exerciseName
    ? exerciseName
        .replace(/^(barbell|dumbbell|cable|kettlebell|weighted)\s+/i, "")
        .replace(/\s+-\s+.*$/, "")
    : undefined;

  return (
    <div
      style={{
        position: "sticky",
        top: SPACE.md,
        left: 0,
        right: 0,
        zIndex: Z_INDEX.pill,
        margin: "0 auto",
        maxWidth: "560px",
        padding: `0 ${SPACE.gutter}`,
      }}
    >
      <div
        onClick={() => setExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        aria-label={
          expanded
            ? "Contraer resumen de sesión"
            : "Expandir resumen de sesión"
        }
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.sm,
          padding: "10px 16px",
          borderRadius: RADIUS.round,
          background: GLASS.fill,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${GLASS.border}`,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
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
              fontSize: TYPE.mono.size,
              fontWeight: 600,
              color: TEXT.primary,
            }}
          >
            {time}
          </span>
          {shortExercise && (
            <span
              style={{
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
                color: TEXT.primary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {shortExercise}
            </span>
          )}
          {setProgressText && (
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontSize: TYPE.caption.size,
                color: STATUS.progression.text,
              }}
            >
              {setProgressText}
            </span>
          )}
        </div>

        {sessionProgressText && (
          <span
            style={{
              fontFamily: TYPE.mono.font,
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
            }}
          >
            {sessionProgressText}
          </span>
        )}
      </div>

      {expanded && (
        <div
          style={{
            marginTop: SPACE.sm,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
            padding: SPACE.md,
            borderRadius: RADIUS.surface,
            border: `1px solid ${GLASS.border}`,
            background: SURFACE.raised,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: SPACE.md,
            }}
          >
            <StatLabel label="Tiempo de sesión" value={time} mono />
            <StatLabel label="Ejercicio actual" value={shortExercise ?? "—"} />
            <StatLabel
              label="Series de este ejercicio"
              value={setProgressText ?? "—"}
              mono
            />
            <StatLabel
              label="Series de la sesión"
              value={sessionProgressText ?? "—"}
              mono
            />
          </div>

          {onEnd && (
            <button
              type="button"
              onClick={onEnd}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: SPACE.sm,
                minHeight: MOTION.minTouchTarget,
                padding: `${SPACE.sm} ${SPACE.lg}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${DANGER.border}`,
                background: DANGER.muted,
                color: DANGER.text,
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <X size={16} aria-hidden="true" />
              Finalizar sesión
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatLabel({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span
        style={{
          display: "block",
          fontSize: TYPE.caption.size,
          fontWeight: TYPE.label.weight,
          letterSpacing: TYPE.label.tracking,
          color: TEXT.tertiary,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "block",
          marginTop: SPACE.xs,
          fontSize: TYPE.mono.size,
          fontWeight: 600,
          fontFamily: mono ? TYPE.mono.font : undefined,
          fontVariantNumeric: mono ? NUMERIC.align : undefined,
          color: TEXT.primary,
        }}
      >
        {value}
      </span>
    </div>
  );
}
