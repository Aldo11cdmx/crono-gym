import { History } from "lucide-react";
import { Link } from "react-router-dom";
import { PROGRESS_PATH } from "@/components/shell/navItems";
import type { DashboardSession } from "@/lib/dashboard/dashboardMetrics";

function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-MX", {
    day: "numeric", month: "short",
  });
}

function duration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "En curso";
  const minutes = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : "—";
}

export function HistorySection({
  sessions,
  className,
  maxVisible = 3,
}: { sessions: readonly DashboardSession[]; className?: string; maxVisible?: number }) {
  const visible = sessions.slice(0, Math.min(maxVisible, 3));
  return (
    <section aria-label="Historial reciente" className={className}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <History size={16} className="text-[#FF3B30]" aria-hidden="true" /> Historial reciente
        </h2>
        <Link to={PROGRESS_PATH} className="text-xs font-semibold text-[#FF3B30]">Ver todo ›</Link>
      </header>
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">Cuando completes sesiones, verás aquí tu actividad más reciente.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] divide-y divide-white/10">
          {visible.map((session) => {
            const workingSets = session.sets.filter((set) => !set.isWarmup);
            return (
              <div key={session.id} className="flex min-h-[68px] items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{session.routineTitle?.trim() || "Sesión"}</p>
                  <p className="truncate font-mono text-xs text-zinc-400">
                    {formatSessionDate(session.startedAt)} · {duration(session.startedAt, session.completedAt)} · {workingSets.length} series
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{session.completedAt ? "Completada" : "Incompleta"}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
