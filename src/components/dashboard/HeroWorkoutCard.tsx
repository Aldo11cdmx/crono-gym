/**
 * HeroWorkoutCard.tsx — the large top card on the dashboard.
 *
 * Premium redesign with a greeting, an active-session banner (when a workout
 * is running), or an idle suggestion card with a start button.
 *
 * Delegates to:
 *   - LiveSessionBanner   (active session body)
 *   - IdleHeroCard        (idle / suggested-routine body)
 *   - HeroGlow            (decorative gradient layer)
 *
 * Public contract stays stable for the loader: `loading`, `suggestedRoutine`,
 * `activeContent` (optional override), `onPrimary`, `primaryLabel`. When
 * `activeSession` is provided the card computes the greeting, chips and progress
 * itself and renders `LiveSessionBanner`.
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";
import { LiveSessionBanner } from "./LiveSessionBanner";
import { IdleHeroCard } from "./IdleHeroCard";
import { HeroGlow } from "@/components/ui/HeroGlow";
import { getGreeting, buildHeroChips } from "@/lib/dashboard/heroCardModel";
import type { RoutineSummary } from "@/lib/dashboard/heroCardModel";

/** Active-session payload sourced from ActiveSessionContext. */
export interface HeroSession {
  startedAt: string;
  title: string;
  doneSets?: number | null;
  plannedSets?: number | null;
  routine?: RoutineSummary | null;
}

export interface HeroWorkoutCardProps {
  /** When true, the card shows a skeleton instead of real content. */
  loading?: boolean;
  /** Suggested routine shown when no session is active and name is known. */
  suggestedRoutine: RoutineSummary | null;
  /** Optional name for the greeting. Falls back to a name-less saludo. */
  name?: string | null;
  /** Active-session data; when present the banner replaces the idle card. */
  activeSession?: HeroSession | null;
  /** Shown as the body when a session is already running (legacy override). */
  activeContent?: ReactNode;
  /** Called when "Empezar" / "Continuar" is pressed. */
  onPrimary: () => void;
}

export function HeroWorkoutCard({
  loading = false,
  suggestedRoutine,
  name = null,
  activeSession = null,
  activeContent,
  onPrimary,
}: HeroWorkoutCardProps) {
  const now = useMemo(() => Date.now(), []);

  if (activeContent) {
    return (
      <DashboardCard title="Entrenamiento" loading={loading} bodyClass="hero-body">
        {activeContent}
      </DashboardCard>
    );
  }

  if (activeSession) {
    const greeting = getGreeting(now, name);
    const routine = activeSession.routine ?? suggestedRoutine;

    return (
      <div style={{ position: "relative", width: "100%" }}>
        <DashboardCard title={greeting} loading={loading} bodyClass="hero-body">
          <LiveSessionBanner
            startedAt={activeSession.startedAt}
            routineName={activeSession.title}
            routine={routine ?? null}
            doneSets={activeSession.doneSets}
            plannedSets={activeSession.plannedSets}
            onContinue={onPrimary}
          />
        </DashboardCard>
        <HeroGlow />
      </div>
    );
  }

  // Idle state — suggested routine or empty.
  const greeting = getGreeting(now, name);
  const routine = suggestedRoutine ?? null;
  const chips = buildHeroChips({
    exerciseCount: routine?.exerciseCount ?? null,
    minutes: routine?.estimatedDurationMin ?? null,
  });

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <DashboardCard title={greeting} loading={loading} bodyClass="hero-body">
        <IdleHeroCard
          greeting={greeting}
          routine={routine}
          chips={chips}
          onStart={onPrimary}
          onCreate={onPrimary}
        />
      </DashboardCard>
      <HeroGlow />
    </div>
  );
}
