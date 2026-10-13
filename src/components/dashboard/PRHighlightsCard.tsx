/**
 * PRHighlightsCard.tsx — the "Recent PRs" panel.
 *
 * Renders the most recent personal records returned by `getRecentPRs`.
 * Each row names the exercise, shows the estimated 1RM, and the date it was
 * achieved. The estimate is labelled as such; Epley is valid only up to 10
 * reps, which `getRecentPRs` enforces by filtering at the source.
 */

import { DashboardCard } from "./DashboardCard";
import { formatDateRelative, formatOneRepMax } from "@/lib/dashboard/formatters";
import type { RecentPR } from "@/lib/dashboard/dashboardMetrics";
import { ACCENT, GLASS, STATUS, TEXT, TYPE } from "@/design/tokens";
import type { Exercise } from "@/types/supabase";

export interface PRHighlightsCardProps {
  loading?: boolean;
  prs: RecentPR[];
  locale?: string;
  unit?: "metric" | "imperial";
  exercisesById?: Map<string, Exercise>;
  onExerciseClick?: (exercise: Exercise | null) => void;
  /** Optional callback for the "Ver todos mis PRs" link. */
  onViewAll?: () => void;
  /** Optional maximum number of PRs to display. Defaults to 3. */
  max?: number;
}

export function PRHighlightsCard({
  loading = false,
  prs,
  locale = "es-ES",
  unit = "metric",
  exercisesById,
  onExerciseClick,
  onViewAll,
  max = 3,
}: PRHighlightsCardProps) {
  if (loading) {
    return (
      <DashboardCard title="Récords recientes" loading>
        <></>
      </DashboardCard>
    );
  }

  const now = Date.now();
  const displayPRs = max > 0 ? prs.slice(0, max) : prs;

  if (displayPRs.length === 0) {
    return (
      <DashboardCard
        title="Récords recientes"
        empty
        emptyLabel="Aún no tienes repeticiones personales registradas."
      >
        <></>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Récords recientes">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
          {displayPRs.map((pr) => {
            const openDetail = () =>
              onExerciseClick?.(exercisesById?.get(pr.exerciseName.toLowerCase()) ?? null);
            return (
              <div
                key={`${pr.exerciseName}-${pr.achievedAt}`}
                role={onExerciseClick ? "button" : undefined}
                tabIndex={onExerciseClick ? 0 : undefined}
                onClick={onExerciseClick ? openDetail : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: `1px solid ${GLASS.fill}`,
                  cursor: onExerciseClick ? "pointer" : undefined,
                }}
              >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "20px",
                  height: "20px",
                  color: STATUS.pr.text,
                  fontSize: "10px",
                }}
                aria-label="PR"
                title="Marca personal"
              >
                ★
              </span>
              <span style={{ fontSize: TYPE.body.size, color: TEXT.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                {pr.exerciseName}
              </span>
              <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                ({formatDateRelative(pr.achievedAt.split("T")[0], locale, now)})
              </span>
            </div>

            <div
              style={{
                fontSize: TYPE.mono.size,
                fontWeight: TYPE.mono.weight,
                color: ACCENT.base,
              }}
            >
              {formatOneRepMax(pr.estimated1RM, unit)}
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.tertiary,
                  marginLeft: "4px",
                }}
              >
                {" est."}
              </span>
            </div>
          </div>
          );
        })}
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            style={{
              marginTop: "8px",
              alignSelf: "flex-start",
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              color: ACCENT.base,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Ver todos los PRs ➔
          </button>
        )}
      </div>
    </DashboardCard>
  );
}
