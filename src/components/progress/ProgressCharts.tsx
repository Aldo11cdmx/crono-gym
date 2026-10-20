import type { FC } from "react";

export interface ProgressChartsProps {
  userId: string | null;
}

export const ProgressCharts: FC<ProgressChartsProps> = ({ userId }) => {
  return (
    <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-400">
      ProgressCharts (userId={userId ?? "none"})
    </div>
  );
};

export default ProgressCharts;
