import { useMemo } from "react";
import { Activity, Award, CalendarDays, Dumbbell, TrendingUp } from "lucide-react";
import { formatWeight, type ProgressStats } from "../hooks/useGymData";

interface ProgressDashboardProps {
  stats: ProgressStats;
  loading: boolean;
}

export function ProgressDashboard({ stats, loading }: ProgressDashboardProps) {
  const peak = useMemo(
    () => Math.max(1, ...stats.week.map((point) => point.count)),
    [stats.week],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Tu progreso</h2>
        <p className="text-xs text-neutral-500">
          Resumen de tus últimas {stats.recent.length || 0} sesiones.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<CalendarDays className="h-4 w-4" />}
          label="Entrenamientos"
          value={String(stats.workoutsThisMonth)}
          hint="este mes"
        />
        <Metric
          icon={<Award className="h-4 w-4" />}
          label="Peso máximo"
          value={formatWeight(stats.bestWeight)}
          hint="en serie válida"
        />
        <Metric
          icon={<Dumbbell className="h-4 w-4" />}
          label="Volumen"
          value={`${stats.monthlyVolume.toLocaleString("es-ES")} kg`}
          hint="este mes"
        />
        <Metric
          icon={<TrendingUp className="h-4 w-4" />}
          label="Sesiones totales"
          value={String(stats.totalWorkouts)}
          hint="completadas"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold">Últimos 7 días</h3>
          </div>
          {loading ? (
            <p className="text-sm text-neutral-500">Calculando…</p>
          ) : (
            <div className="flex h-40 items-end gap-2">
              {stats.week.map((point) => (
                <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[11px] tabular-nums text-neutral-500">
                    {point.count || ""}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      point.count > 0 ? "bg-accent" : "bg-white/5"
                    }`}
                    style={{ height: `${Math.max(4, (point.count / peak) * 120)}px` }}
                  />
                  <span className="text-[11px] capitalize text-neutral-500">{point.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass backdrop-blur-md">
          <h3 className="mb-4 text-sm font-semibold">Sesiones recientes</h3>
          {loading ? (
            <p className="text-sm text-neutral-500">Cargando…</p>
          ) : stats.recent.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Cuando termines tu primera sesión aparecerá aquí.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.recent.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{session.routineTitle}</p>
                    <p className="text-[11px] text-neutral-500">
                      {formatDate(session.started_at)} · {session.sets} series
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                    {session.volume.toLocaleString("es-ES")} kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-glass backdrop-blur-md">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}