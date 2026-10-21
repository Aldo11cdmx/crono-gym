/**
 * ActiveWorkoutView.tsx — the immersive workout screen, with top-bar chrome and a
 * save-first finish flow.
 *
 * Wraps `ActiveWorkout` and adds:
 *  - Top bar: session clock, ⚙️, "Terminar"
 *  - "Terminar" opens `WorkoutSummaryModal` instead of ending outright
 *  - Summary modal saves via `queueAndSync` (workout_logs + completed_sets)
 */

import { useCallback, useState } from "react";
import { Settings } from "lucide-react";
import type { PlannedExercise } from "../../hooks/useGymData";
import type { DraftExercise } from "../../lib/offlineStore";
import { useActiveSession } from "../../context/ActiveSessionContext";
import { ActiveWorkout } from "../ActiveWorkout";
import { WorkoutSummaryModal } from "./WorkoutSummaryModal";
import {
  GLASS,
  RADIUS,
  SPACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "../../design/tokens";

export interface ActiveWorkoutViewProps {
  userId: string;
  routineId: string | null;
  routineTitle: string;
  planned: PlannedExercise[];
  onFinished: () => void;
}

export function ActiveWorkoutView({
  userId,
  routineId,
  routineTitle,
  planned,
  onFinished,
}: ActiveWorkoutViewProps) {
  const { session, end } = useActiveSession();
  const [summaryOpen, setSummaryOpen] = useState(false);

  const startedAt = session?.startedAt ?? new Date().toISOString();
  const completedAt = new Date().toISOString();

  const handleFinish = useCallback(() => {
    setSummaryOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    setSummaryOpen(false);
    end();
    onFinished();
  }, [end, onFinished]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: Z_INDEX.sticky,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.md,
          padding: `${SPACE.sm} ${SPACE.lg}`,
          borderBottom: `1px solid ${GLASS.border}`,
          background: GLASS.fillRaised,
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            fontFamily: TYPE.mono.font,
            fontSize: TYPE.mono.size,
            fontWeight: TYPE.mono.weight,
            color: TEXT.primary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {new Date(startedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <button
          type="button"
          aria-label="Ajustes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 40,
            minHeight: 40,
            borderRadius: RADIUS.chip,
            border: `1px solid ${GLASS.borderStrong}`,
            background: "transparent",
            color: TEXT.secondary,
            cursor: "pointer",
          }}
        >
          <Settings
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={handleFinish}
          aria-label="Terminar entrenamiento"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: SPACE.xs,
            minHeight: 40,
            padding: `0 ${SPACE.lg}`,
            borderRadius: RADIUS.chip,
            border: `1px solid ${GLASS.borderStrong}`,
            background: "transparent",
            color: TEXT.primary,
            fontSize: TYPE.subhead.size,
            fontWeight: TYPE.subhead.weight,
            cursor: "pointer",
          }}
        >
          Terminar
        </button>
      </header>

      <ActiveWorkout
        userId={userId}
        routineId={routineId}
        routineTitle={routineTitle}
        planned={planned}
        onFinished={handleFinish}
      />

      <WorkoutSummaryModal
        isOpen={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        routineTitle={routineTitle}
        startedAt={startedAt}
        completedAt={completedAt}
        exercises={[] as DraftExercise[]}
        userId={userId}
        routineId={routineId}
        onSaved={handleSave}
      />
    </div>
  );
}
