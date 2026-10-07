/**
 * DashboardPage.tsx — the home dashboard that wires pure helpers to live data.
 *
 * Pulls four reads (profile, routines, recent sessions, PRs), converts their raw
 * rows into the minimal shapes the pure helpers consume, and lays out the
 * dashboard grid: a hero card on top, a metrics row, and a floating action
 * button tucked in the bottom-right corner.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useProfile } from "@/hooks/useProfile";
import { useRoutines, type PlannedExercise } from "@/hooks/useGymData";
import { useDashboardSessions } from "@/hooks/useDashboardSessions";
import { useAthletePRs, type AthletePR } from "@/hooks/useAthletePRs";
import { ROUTINES_PATH, TRAIN_PATH } from "@/components/shell/navItems";
import { ACCENT, TEXT, TYPE } from "@/design/tokens";
import {
  getNextSuggestedRoutine,
  getRecentPRs,
  getStreakStats,
  getVolumeTrend,
  getWeeklyProgress,
  estimateOneRepMax,
  type RecentPR,
  type RoutineSummary,
} from "@/lib/dashboard/dashboardMetrics";
import { HeroWorkoutCard } from "./HeroWorkoutCard";
import { StreakAndVolumeWidget } from "./StreakAndVolumeWidget";
import { WeeklyGoalCard } from "./WeeklyGoalCard";
import { PRHighlightsCard } from "./PRHighlightsCard";
import { QuickActionButton, type QuickActionItem } from "./QuickActionButton";
import type { UnitSystem } from "@/lib/profile";

export interface DashboardPageProps {
  userId: string;
}

/** Convert a routine from the catalog into the minimal shape the planner needs. */
function toRoutineSummary(routine: { id: string; title: string; exercises: PlannedExercise[] }): RoutineSummary {
  const restSecondsPerExercise =
    routine.exercises.length > 0
      ? Math.round(
          routine.exercises.reduce((sum, e) => sum + e.rest_seconds, 0) / routine.exercises.length,
        )
      : 300;
  return {
    id: routine.id,
    title: routine.title,
    exerciseCount: routine.exercises.length,
    restSecondsPerExercise,
  };
}

/** Convert an athlete PR row into the dashboard's `RecentPR` shape. */
function toRecentPR(pr: AthletePR): RecentPR {
  const estimated1RM = estimateOneRepMax(pr.weightKg, pr.reps ?? 1);
  return {
    exerciseName: pr.exerciseName,
    estimated1RM: estimated1RM ?? pr.weightKg,
    achievedAt: pr.achievedAt,
  };
}

export function DashboardPage({ userId }: DashboardPageProps) {
  const navigate = useNavigate();

  const { profile, loading: profileLoading } = useProfile(userId);
  const { routines, loading: routinesLoading } = useRoutines(userId);
  const { sessions, loading: sessionsLoading } = useDashboardSessions(userId);
  const { prs: athletePRs, loading: prsLoading } = useAthletePRs(userId);
  const { session: activeSession, isActive, start } = useActiveSession();

  const unitSystem: UnitSystem = profile?.unit_system ?? "metric";
  const now = useMemo(() => Date.now(), []);

  const loading = profileLoading || sessionsLoading || prsLoading;
  void routinesLoading;

  // Plan summaries for the rotation helper.
  const plan = useMemo(
    () => routines.map(toRoutineSummary),
    [routines],
  );

  // Suggested routine: least-recently-trained, or null when none exist.
  const suggestedRoutine = useMemo(
    () => getNextSuggestedRoutine(plan, sessions, now),
    [plan, sessions, now],
  );

  // Derived metrics, all from the same `now` so they agree.
  const streak = useMemo(() => getStreakStats(sessions, now), [sessions, now]);
  const volume = useMemo(() => getVolumeTrend(sessions, now), [sessions, now]);
  const weeklyProgress = useMemo(() => getWeeklyProgress(sessions, now), [sessions, now]);
  const recentPRs = useMemo(
    () => getRecentPRs(sessions, now),
    [sessions, now],
  );

  // Prefer the PR helper's list when sessions haven't produced recent PRs but
  // the athlete record store has them.
  const displayPRs = recentPRs.length > 0 ? recentPRs : athletePRs.map(toRecentPR);

  const handleStart = () => {
    if (suggestedRoutine) {
      start({ id: suggestedRoutine.id, title: suggestedRoutine.title });
    } else {
      start(null);
    }
    navigate(TRAIN_PATH);
  };

  // Active-session banner shown inside the hero card when a workout is running.
  const activeContent = isActive ? (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <span style={{ fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
        Entrenamiento en curso: {activeSession?.title ?? "Sesión"}
      </span>
      <button
        type="button"
        onClick={() => navigate(TRAIN_PATH)}
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          border: "none",
          background: ACCENT.base,
          color: TEXT.onAccent,
          fontSize: TYPE.subhead.size,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Continuar
      </button>
    </div>
  ) : undefined;

  const quickActions: QuickActionItem[] = [
    {
      id: "routine",
      label: "Nueva rutina",
      icon: "➕",
      onChoose: () => navigate(ROUTINES_PATH),
    },
    {
      id: "log",
      label: "Registro rápido",
      icon: "📔",
      onChoose: () => {
        start(null);
        navigate(TRAIN_PATH);
      },
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* Hero — suggested routine or active-session banner */}
      <HeroWorkoutCard
        loading={loading}
        suggestedRoutine={
          suggestedRoutine
            ? {
                title: suggestedRoutine.title,
                exerciseCount: suggestedRoutine.exerciseCount,
                estimatedDurationMin: suggestedRoutine.estimatedDurationMin,
              }
            : null
        }
        activeContent={activeContent}
        onPrimary={handleStart}
      />

      {/* Metrics row: streak, weekly goal, PRs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "24px",
        }}
      >
        <StreakAndVolumeWidget
          loading={loading}
          streak={isActive ? null : streak}
          volume={isActive ? null : volume}
          unit={unitSystem}
        />

        <WeeklyGoalCard
          loading={loading}
          progress={weeklyProgress}
        />

        <PRHighlightsCard
          loading={loading}
          prs={displayPRs}
          unit={unitSystem}
        />
      </div>

      {/* Floating action button */}
      <QuickActionButton actions={quickActions} loading={loading} />
    </div>
  );
}
