import { Trophy } from "lucide-react";
import type { RecentPR, TopRecord } from "@/lib/dashboard/dashboardMetrics";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** Epley estimate rounded to at most one decimal, so the card never shows 125.41666666666667. */
function formatEstimated1RM(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString("es-MX", { maximumFractionDigits: 1 });
}

/** Localized exercise name: the Spanish dictionary first, then the raw name as a last resort. */
function localizedName(name: string): string {
  return getExerciseDisplayName({ name });
}

export function PRSection({ topRecords, recentPRs, className }: { topRecords: readonly TopRecord[]; recentPRs: readonly RecentPR[]; compact?: boolean; className?: string }) {
  return (
    <section aria-label="Récords recientes" className={className}>
      <header className="mb-3 flex items-center gap-2">
        <Trophy size={16} className="text-[#FF3B30]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white">Récords recientes</h2>
      </header>
      {topRecords.length === 0 ? (
        <p className="text-sm text-zinc-500">Completa entrenamientos para ver tus mejores marcas aquí.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] divide-y divide-white/10">
          {topRecords.slice(0, 3).map((pr) => (
            <div key={`${pr.exerciseName}-${pr.achievedAt}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{localizedName(pr.exerciseName)}</p>
                <p className="text-xs text-zinc-400">{formatDate(pr.achievedAt)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-base font-bold text-white">{pr.weight} kg × {pr.reps}</p>
                <span className="rounded-full bg-[#2C2C2E] px-2 py-1 font-mono text-[11px] text-zinc-400">1RM ~{formatEstimated1RM(pr.estimated1RM)} kg</span>
                {recentPRs.some((recent) => recent.exerciseName === pr.exerciseName) && (
                  <span className="ml-1 rounded-full bg-[#FF3B30]/15 px-2 py-1 font-mono text-[11px] text-[#FF3B30]">NUEVO</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
