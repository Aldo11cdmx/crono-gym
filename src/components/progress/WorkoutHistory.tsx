import type { FC } from "react";

export interface WorkoutHistoryProps {
  userId: string | null;
}

export const WorkoutHistory: FC<WorkoutHistoryProps> = ({ userId }) => {
  return (
    <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-400">
      WorkoutHistory (userId={userId ?? "none"})
    </div>
  );
};

export default WorkoutHistory;
