import { Trophy } from "lucide-react";
import { useMemo } from "react";
import type { RecentPR, TopRecord } from "@/lib/dashboard/dashboardMetrics";
import { useCatalogOverridesVersion } from "@/hooks/useCatalogOverrides";
import { resolveCatalogExerciseWithOverrides } from "@/lib/catalog/resolveExercise";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** Epley estimate rounded to at most one decimal, so the card never shows 125.41666666666667. */
function formatEstimated1RM(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString("es-MX", { maximumFractionDigits: 1 });
}

/**
 * The name a record should show.
 *
 * A record stores the name the session had; a coach's rename is not that name any
 * more. When the row carries its id the catalog is asked, so a renamed exercise
 * reads the same in the records as it does in the session.
 */
function recordName(record: RecentPR): string {
  const resolved = record.exerciseId
    ? resolveCatalogExerciseWithOverrides(record.exerciseId)
    : null;
  return resolved?.displayName ?? localizedName(record.exerciseName);
}

/** Localized exercise name: the Spanish dictionary first, then the raw name as a last resort. */
function localizedName(name: string): string {
  return getExerciseDisplayName({ name });
}

export function PRSection({ topRecords, recentPRs, className }: { topRecords: readonly TopRecord[]; recentPRs: readonly RecentPR[]; compact?: boolean; className?: string }) {
  // A rename made while this screen is open changes the records too; the version is
  // the reason to re-read them.
  const catalogRevision = useCatalogOverridesVersion();
  const names = useMemo(
    () => new Map(topRecords.map((record) => [record, recordName(record)] as const)),
    [topRecords, catalogRevision],
  );

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
                <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-white">{names.get(pr) ?? localizedName(pr.exerciseName)}</p>
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
