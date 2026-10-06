/**
 * HeroWorkoutCard.tsx — the large top card on the dashboard.
 *
 * When no session is active it shows a suggested routine (name, exercise count,
 * estimated duration) and a "Empezar" button. When a session is already running
 * it defers to the caller's `activeContent` so the banner can live here without
 * the card knowing about `ActiveSessionContext`.
 */

import type { ReactNode } from "react";
import { DashboardCard } from "./DashboardCard";
import { formatDuration } from "@/lib/dashboard/formatters";
import { ACCENT, RADIUS, TEXT, TYPE } from "@/design/tokens";

export interface HeroWorkoutCardProps {
  /** When true, the card shows a skeleton instead of real content. */
  loading?: boolean;
  /**
   * The suggested routine to present when no session is active.
   * Pass `null` when a session is active — the caller takes over the body.
   */
  suggestedRoutine: {
    title: string;
    exerciseCount: number;
    estimatedDurationMin: number;
  } | null;
  /** Shown as the body when a session is already running. */
  activeContent?: ReactNode;
  onPrimary: () => void;
  primaryLabel?: string;
}

export function HeroWorkoutCard({
  loading = false,
  suggestedRoutine,
  activeContent,
  onPrimary,
  primaryLabel = "Empezar",
}: HeroWorkoutCardProps) {
  return (
    <DashboardCard
      title="Entrenamiento"
      loading={loading}
      bodyClass="hero-body"
    >
      {activeContent ??
        (suggestedRoutine ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: TYPE.hero.size,
                  fontWeight: TYPE.hero.weight,
                  margin: 0,
                  color: TEXT.primary,
                }}
              >
                {suggestedRoutine.title}
              </h3>
              <p
                style={{
                  fontSize: TYPE.body.size,
                  color: TEXT.secondary,
                  margin: "8px 0 0",
                }}
              >
                {suggestedRoutine.exerciseCount} ejercicios ·{" "}
                {formatDuration(suggestedRoutine.estimatedDurationMin * 60)}
              </p>
            </div>
            <button
              type="button"
              onClick={onPrimary}
              style={{
                alignSelf: "flex-start",
                padding: "10px 24px",
                borderRadius: RADIUS.control,
                border: "none",
                background: ACCENT.base,
                color: TEXT.onAccent,
                fontSize: TYPE.body.size,
                fontWeight: 600,
                cursor: "pointer",
                transition: `background ${"150ms"}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = ACCENT.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = ACCENT.base;
              }}
            >
              {primaryLabel}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <p style={{ fontSize: TYPE.body.size, color: TEXT.secondary, margin: 0 }}>
              No hay rutina programada.
            </p>
            <button
              type="button"
              onClick={onPrimary}
              style={{
                alignSelf: "flex-start",
                padding: "10px 24px",
                borderRadius: RADIUS.control,
                border: "none",
                background: ACCENT.base,
                color: TEXT.onAccent,
                fontSize: TYPE.body.size,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {primaryLabel}
            </button>
          </div>
        ))}
    </DashboardCard>
  );
}
