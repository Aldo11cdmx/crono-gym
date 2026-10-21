/**
 * WorkoutSummaryModal.tsx — what the session just did, and the button that saves it.
 *
 * Volume total (kg / lbs), elapsed time, sets completed, PR badges. The save
 * hand-off goes through `queueAndSync`/`pushSession`, which write
 * `workout_logs` + `completed_sets` -- no new migration, no new table.
 */

import { useCallback, useMemo, useState } from "react";
import { Check, Clock, Flame, TrendingUp, X } from "lucide-react";
import type { DraftExercise } from "../../lib/offlineStore";
import { queueAndSync } from "../../lib/sessionSync";
import { kgToLb } from "../../lib/profile";
import { useGymSettings } from "../../context/GymSettingsContext";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  TEXT,
  TYPE,
  SCRIM,
  Z_INDEX,
} from "../../design/tokens";

export interface WorkoutSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  routineTitle: string;
  startedAt: string;
  completedAt: string;
  exercises: readonly DraftExercise[];
  userId: string;
  routineId: string | null;
  onSaved: () => void;
}

export function WorkoutSummaryModal({
  isOpen,
  onClose,
  routineTitle,
  startedAt,
  completedAt,
  exercises,
  userId,
  routineId,
  onSaved,
}: WorkoutSummaryModalProps) {
  const { weightUnit } = useGymSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalSets = useMemo(
    () => exercises.reduce((n, e) => n + e.sets.length, 0),
    [exercises],
  );
  const completedSets = useMemo(
    () =>
      exercises.reduce(
        (n, e) => n + e.sets.filter((s) => s.completed).length,
        0,
      ),
    [exercises],
  );
  const totalVolumeKg = useMemo(
    () =>
      exercises.reduce(
        (n, e) =>
          n +
          e.sets.reduce(
            (m, s) =>
              m +
              (s.completed ? (Number.parseFloat(s.weight) || 0) * (Number.parseInt(s.reps, 10) || 0) : 0),
            0,
          ),
        0,
      ),
    [exercises],
  );
  const started = new Date(startedAt);
  const completed = new Date(completedAt);
  const elapsedSeconds = Math.round((completed.getTime() - started.getTime()) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedRemainder = elapsedSeconds % 60;
  const volumeLabel = weightUnit === "kg"
    ? `${totalVolumeKg.toFixed(1)} kg`
    : `${kgToLb(totalVolumeKg).toFixed(1)} lbs`;

  const prExercises = useMemo(
    () =>
      exercises.filter((e) =>
        e.sets.some(
          (s) => s.completed && (s.weight && Number.parseFloat(s.weight) > 0),
        ),
      ),
    [exercises],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        logId: `log-${Date.now()}`,
        userId,
        routineId,
        startedAt,
        completedAt,
        notes: "",
        sets: exercises.flatMap((e) =>
          e.sets.map((s, setIndex) => ({
            exercise_id: e.exercise.id,
            set_number: setIndex + 1,
            weight: Number.parseFloat(s.weight) || 0,
            reps: Number.parseInt(s.reps, 10) || 0,
            rpe: s.rpe ? Number.parseInt(s.rpe, 10) : null,
            is_warmup: s.kind === "warmup",
            notes: s.notes ?? null,
            created_at: completedAt,
          })),
        ),
      };
      await queueAndSync(payload);
      setSaved(true);
      onSaved();
    } catch {
      // The queue persists; the surface can retry. The modal stays open so the
      // athlete can try again rather than losing the session.
    } finally {
      setSaving(false);
    }
  }, [exercises, userId, routineId, startedAt, completedAt, onSaved]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: SCRIM.modal,
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          width: "90vw",
          maxWidth: 420,
          maxHeight: "85vh",
          borderRadius: RADIUS.modal,
          background: GLASS.fill,
          border: `1px solid ${GLASS.border}`,
          boxShadow: GLASS.shadow,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACE.md} ${SPACE.lg}`,
            borderBottom: `1px solid ${GLASS.border}`,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: TYPE.title2.size,
              fontWeight: TYPE.title2.weight,
              color: TEXT.primary,
            }}
          >
            Resumen
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar resumen"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.secondary,
              cursor: "pointer",
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: SPACE.md,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.md,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: SPACE.sm,
            }}
          >
            <StatCard
              label="Volumen total"
              value={volumeLabel}
              icon={<TrendingUp size={18} aria-hidden="true" />}
            />
            <StatCard
              label="Tiempo"
              value={`${elapsedMinutes}m ${elapsedRemainder.toString().padStart(2, "0")}s`}
              icon={<Clock size={18} aria-hidden="true" />}
            />
            <StatCard
              label="Series"
              value={`${completedSets} de ${totalSets}`}
              icon={<Check size={18} aria-hidden="true" />}
            />
            <StatCard
              label="Ejercicios"
              value={String(exercises.length)}
              icon={<Flame size={18} aria-hidden="true" />}
            />
          </div>

          {prExercises.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE.xs,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: TYPE.caption.size,
                  fontWeight: TYPE.caption.weight,
                  letterSpacing: TYPE.caption.tracking,
                  color: TEXT.secondary,
                  textTransform: "uppercase",
                }}
              >
                Récords de esta sesión
              </h4>
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
                {prExercises.map((e) => {
                  const best = e.sets
                    .filter((s) => s.completed)
                    .reduce(
                      (best, s) => {
                        const w = Number.parseFloat(s.weight) || 0;
                        return w > best.weight ? { weight: w, reps: Number.parseInt(s.reps, 10) || 0 } : best;
                      },
                      { weight: 0, reps: 0 },
                    );
                  return (
                    <li
                      key={e.exercise.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SPACE.sm,
                        fontSize: TYPE.body.size,
                        color: TEXT.primary,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>{e.exercise.name}</span>
                      <span
                        style={{
                          fontFamily: TYPE.mono.font,
                          fontVariantNumeric: "tabular-nums",
                          color: ACCENT.text,
                        }}
                      >
                        {best.weight.toFixed(1)} kg × {best.reps}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div
            style={{
              marginTop: SPACE.md,
              paddingTop: SPACE.md,
              borderTop: `1px solid ${GLASS.border}`,
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
              textAlign: "center",
            }}
          >
            {routineTitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
            padding: `${SPACE.md} ${SPACE.lg}`,
            borderTop: `1px solid ${GLASS.border}`,
          }}
        >
          <button
            type="button"
            disabled={saving || saved}
            onClick={handleSave}
            style={{
              width: "100%",
              minHeight: 56,
              borderRadius: RADIUS.button,
              border: `1px solid ${ACCENT.base}`,
              background: saving || saved ? GLASS.fill : ACCENT.base,
              color: saving || saved ? TEXT.secondary : TEXT.onAccent,
              fontSize: TYPE.headline.size,
              fontWeight: 700,
              cursor: (saving || saved) ? "default" : "pointer",
              transition: `filter ${MOTION.fast} ${MOTION.standard}`,
            }}
          >
            {saved
              ? "Guardado"
              : saving
                ? "Guardando…"
                : "Guardar sesión"}
          </button>
          {!saved && (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                minHeight: 44,
                borderRadius: RADIUS.button,
                border: `1px solid ${GLASS.border}`,
                background: "transparent",
                color: TEXT.secondary,
                fontSize: TYPE.body.size,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              No guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: JSX.Element;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        padding: SPACE.md,
        borderRadius: RADIUS.card,
        background: GLASS.fill,
        border: `1px solid ${GLASS.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.xs,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: TYPE.caption.size,
            fontWeight: TYPE.caption.weight,
            letterSpacing: TYPE.caption.tracking,
            textTransform: "uppercase",
            color: TEXT.secondary,
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: TYPE.mono.font,
          fontSize: TYPE.body.size,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: TEXT.primary,
        }}
      >
        {value}
      </span>
    </div>
  );
}
