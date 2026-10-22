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
import type { PlannedExercise } from "../../hooks/useGymData";
import type { DraftExercise } from "../../lib/offlineStore";
import { useActiveSession } from "../../context/ActiveSessionContext";
import { ActiveWorkout } from "../ActiveWorkout";
import { WorkoutSummaryModal } from "./WorkoutSummaryModal";

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
