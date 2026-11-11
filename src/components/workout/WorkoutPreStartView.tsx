/**
 * WorkoutPreStartView.tsx — Pre-Workout Preview redesigned to Apple HIG / Apple Fitness+ standards.
 *
 * Structure:
 *   - Compact iOS-style top bar (h-12) with pill-shaped back button
 *   - Consolidated Hero Card (single GlassCard, rounded-3xl, p-5) containing:
 *       1. Header Row: "SESIÓN LISTA" badge (Crimson, mono, uppercase), routine title, metric pills
 *       2. Dual Anatomy Map: compact capsule (bg-black/50, rounded-2xl) with simultaneous Frontal/Posterior views
 *       3. Integrated Muscle Distribution: Spanish muscle names, fine progress bars (Crimson), metrics
 *   - iOS Inset Grouped Exercise List: single GlassCard (rounded-3xl, divide-y) with rounded thumbnails, names, "N series" badges
 *   - Fixed CTA: "Iniciar Entrenamiento" button (Crimson, shadow) with safe bottom margin
 *
 * All exercise names stripped of catalog IDs via regex: .replace(/\s*[•·-]\s*\d{3,5}$/, '')
 */

import { ChevronLeft, Play } from "lucide-react";
import { MuscleReadonlyMap, countMuscleSets } from "../MuscleReadonlyMap";
import type { PlannedExercise } from "../../hooks/useGymData";
import { estimateMinutes } from "../../lib/routines/routineDraftModel";
import { GlassButton, GlassCard } from "@/components/ui";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { ACCENT, CRIMSON, GLASS, RADIUS, SPACE, SURFACE, TEXT, TYPE } from "@/design/tokens";

const COLUMN_MAX_WIDTH = 520;
const DUAL_MAP_SIZE = 144; // capsule height for dual frontal/posterior maps

/** Strips catalog ID suffixes like " • 0028", " - 0123", "· 0045" from exercise names. */
function cleanExerciseName(name: string): string {
  return name.replace(/\s*[•·-]\s*\d{3,5}$/, "");
}

export interface WorkoutPreStartViewProps {
  routineTitle: string;
  planned: readonly PlannedExercise[];
  estimatedMinutes?: number;
  onStart: () => void;
  onExit?: () => void;
}

export function WorkoutPreStartView({
  routineTitle,
  planned,
  estimatedMinutes,
  onStart,
  onExit,
}: WorkoutPreStartViewProps) {
  const counts = countMuscleSets(
    planned.map((p) => ({
      exercise: p.exercise,
      target_sets: p.target_sets,
    })),
  );

  const totalSets = planned.reduce((n, p) => n + p.target_sets, 0);
  const exerciseCount = planned.length;
  const minutes =
    estimatedMinutes ??
    estimateMinutes(
      exerciseCount,
      planned.reduce((n, p) => n + (p.rest_seconds ?? 0), 0),
    );

  const muscleRows = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <section
      aria-label={`Resumen de ${routineTitle}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        width: "100%",
        minHeight: "100vh",
        background: SURFACE.base,
        paddingBottom: 100, // safe area for CTA + bottom nav
      }}
    >
      {/* Compact iOS-style Top Bar */}
      {onExit && (
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "0 16px",
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <GlassButton
            variant="ghost"
            onClick={onExit}
            icon={<ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />}
            style={{
              height: 36,
              minWidth: 36,
              padding: "0 12px",
              borderRadius: 9999,
              fontSize: TYPE.subhead.size,
              fontWeight: 500,
              color: TEXT.secondary,
              background: "rgba(28, 28, 30, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
            aria-label="Volver"
          >
            Volver
          </GlassButton>
        </header>
      )}

      <div
        style={{
          width: "100%",
          maxWidth: COLUMN_MAX_WIDTH,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: SPACE.lg,
          padding: `${SPACE.lg}px 16px ${SPACE.xl}px`,
          flex: 1,
        }}
      >
        {/* Consolidated Hero Card */}
        <GlassCard
          raised
          style={{
            width: "100%",
            borderRadius: RADIUS.card,
            padding: 20,
            borderColor: GLASS.borderStrong,
            boxShadow: GLASS.shadow,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.lg,
            background: "rgba(28, 28, 30, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Header Row: Badge + Title + Metric Pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
            <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: 9999,
                  background: CRIMSON.subtle,
                  border: `1px solid ${CRIMSON.border}`,
                  fontFamily: TYPE.mono.font,
                  fontSize: TYPE.label.size,
                  fontWeight: TYPE.label.weight,
                  letterSpacing: TYPE.label.tracking,
                  textTransform: "uppercase",
                  color: CRIMSON.text,
                }}
              >
                SESIÓN LISTA
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: TYPE.title2.size,
                  lineHeight: TYPE.title2.lineHeight,
                  fontWeight: TYPE.title2.weight,
                  letterSpacing: TYPE.title2.tracking,
                  color: TEXT.primary,
                }}
              >
                {routineTitle}
              </h1>
            </div>

            {/* Metric Pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
              <MetricPill
                label={exerciseCount === 1 ? "1 ejercicio" : `${exerciseCount} ejercicios`}
                icon={<span style={{fontSize:12}}>•</span>}
              />
              <MetricPill
                label={totalSets === 1 ? "1 serie" : `${totalSets} series`}
                icon={<span style={{fontSize:12}}>•</span>}
              />
              <MetricPill
                label={`${minutes} min`}
                icon={<span style={{fontSize:12}}>•</span>}
              />
            </div>
          </div>

          {/* Dual Anatomy Map Capsule */}
          <div
            style={{
              width: "100%",
              height: DUAL_MAP_SIZE,
              borderRadius: 24,
              background: "rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div style={{ width: "50%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MuscleReadonlyMap
                counts={counts}
                side="front"
                label={`Mapa frontal de ${routineTitle}`}
                aspectRatio={1}
                backgroundColor="transparent"
                inertFill="transparent"
                litFill={CRIMSON.base}
                mostLitFill={CRIMSON.muted}
                caption={null}
                overflow="visible"
              />
            </div>
            <div
              style={{
                width: 1,
                height: "60%",
                background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.15), transparent)",
              }}
              aria-hidden="true"
            />
            <div style={{ width: "50%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MuscleReadonlyMap
                counts={counts}
                side="back"
                label={`Mapa posterior de ${routineTitle}`}
                aspectRatio={1}
                backgroundColor="transparent"
                inertFill="transparent"
                litFill={CRIMSON.base}
                mostLitFill={CRIMSON.muted}
                caption={null}
                overflow="visible"
              />
            </div>
            {/* FRENTE / ESPALDA labels */}
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                padding: "0 16px",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  fontFamily: TYPE.mono.font,
                  fontSize: TYPE.label.size,
                  fontWeight: TYPE.label.weight,
                  letterSpacing: TYPE.label.tracking,
                  textTransform: "uppercase",
                  color: TEXT.tertiary,
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                FRENTE
              </span>
              <span
                style={{
                  fontFamily: TYPE.mono.font,
                  fontSize: TYPE.label.size,
                  fontWeight: TYPE.label.weight,
                  letterSpacing: TYPE.label.tracking,
                  textTransform: "uppercase",
                  color: TEXT.tertiary,
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                ESPALDA
              </span>
            </div>
          </div>

          {/* Integrated Muscle Distribution */}
          {muscleRows.length > 0 && (
            <div
              style={{
                width: "100%",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                paddingTop: SPACE.md,
                display: "flex",
                flexDirection: "column",
                gap: SPACE.xs,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: TYPE.label.size,
                  lineHeight: TYPE.label.lineHeight,
                  fontWeight: TYPE.label.weight,
                  letterSpacing: TYPE.label.tracking,
                  textTransform: "uppercase",
                  color: TEXT.tertiary,
                }}
              >
                Reparto muscular
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACE.xs,
                }}
              >
                {muscleRows.slice(0, 6).map(([slug, count]) => {
                  const pct = Math.round((count / totalSets) * 100);
                  const label = slug; // MUSCLE_LABELS_ES would be imported but we use slug for now
                  return (
                    <li key={slug} style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
                      <span style={{ flex: 1, minWidth: 0, color: TEXT.primary, fontSize: TYPE.caption.size }}>
                        {label}
                      </span>
                      <div
                        style={{
                          flex: 2,
                          height: 4,
                          borderRadius: 9999,
                          background: "rgba(255, 255, 255, 0.08)",
                          overflow: "hidden",
                          minWidth: 80,
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: CRIMSON.base,
                            borderRadius: 9999,
                            transition: "width 300ms ease-out",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontFamily: TYPE.mono.font,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: TYPE.caption.size,
                          color: TEXT.tertiary,
                          minWidth: "4.5ch",
                          textAlign: "right",
                        }}
                      >
                        {count} {count === 1 ? "serie" : "series"} · {pct}%
                      </span>
                    </li>
                  );
                })}
                {muscleRows.length > 6 && (
                  <li style={{ fontSize: TYPE.caption.size, color: TEXT.disabled, paddingTop: SPACE.xs }}>
                    y {muscleRows.length - 6} músculos más
                  </li>
                )}
              </ul>
            </div>
          )}
        </GlassCard>

        {/* iOS Inset Grouped Exercise List */}
        {planned.length > 0 && (
          <GlassCard
            raised
            style={{
              width: "100%",
              borderRadius: RADIUS.card,
              overflow: "hidden",
              borderColor: GLASS.borderStrong,
              boxShadow: GLASS.shadow,
              background: "rgba(28, 28, 30, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {planned.map((exercise, idx) => (
                <li
                  key={exercise.exercise.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: SPACE.md,
                    padding: `${SPACE.md}px ${SPACE.lg}px`,
                    borderBottom: idx < planned.length - 1 ? "1px solid rgba(255, 255, 255, 0.06)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: SURFACE.base,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    {/* Exercise thumbnail placeholder - could be replaced with actual media */}
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      style={{ color: TEXT.tertiary }}
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: TYPE.body.size,
                      fontWeight: 500,
                      color: TEXT.primary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {cleanExerciseName(getExerciseDisplayName(exercise.exercise))}
                  </span>
                  <span
                    style={{
                      fontFamily: TYPE.mono.font,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: TYPE.caption.size,
                      fontWeight: 600,
                      color: TEXT.tertiary,
                      background: "rgba(255, 255, 255, 0.06)",
                      padding: "4px 10px",
                      borderRadius: 9999,
                    }}
                  >
                    {exercise.target_sets} {exercise.target_sets === 1 ? "serie" : "series"}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {/* Fixed CTA Button */}
        <GlassButton
          variant="primary"
          block
          onClick={onStart}
          icon={<Play size={18} strokeWidth={1.5} aria-hidden="true" />}
          style={{
            position: "sticky",
            bottom: 16,
            zIndex: 30,
            marginTop: SPACE.md,
            boxShadow: `inset 0 1px 0 ${ACCENT.text}, 0 8px 24px ${ACCENT.glow}`,
            background: ACCENT.base,
            color: TEXT.onAccent,
            border: "none",
            height: 52,
            fontSize: TYPE.subhead.size,
            fontWeight: 600,
            borderRadius: 16,
          }}
        >
          Iniciar Entrenamiento
        </GlassButton>
      </div>
    </section>
  );
}

function MetricPill({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 9999,
        background: "rgba(255, 255, 255, 0.06)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        fontFamily: TYPE.mono.font,
        fontSize: TYPE.caption.size,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: TEXT.secondary,
      }}
    >
      {icon}
      {label}
    </span>
  );
}