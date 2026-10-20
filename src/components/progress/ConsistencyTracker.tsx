import type { FC } from "react";

export interface ConsistencyTrackerProps {
  userId: string | null;
}

export const ConsistencyTracker: FC<ConsistencyTrackerProps> = ({ userId }) => {
  return (
    <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-400">
      ConsistencyTracker (userId={userId ?? "none"})
    </div>
  );
};

export default ConsistencyTracker;
