/**
 * WorkoutSummaryModal.tsx — what the session just did, and the button that saves it.
 *
 * Volume total (kg / lbs), elapsed time, sets completed, PR badges. The save
 * hand-off goes through `queueAndSync`/`pushSession`, which write
 * `workout_logs` + `completed_sets` -- no new migration, no new table.
 */

import { useCallback, useMemo, useState } from "react";
import { Check, Clock, Flame, Share2, TrendingUp, X } from "lucide-react";
import type { DraftExercise } from "../../lib/offlineStore";
import { queueAndSync } from "../../lib/sessionSync";
import { kgToLb } from "../../lib/profile";
import { useGymSettings } from "../../context/GymSettingsContext";
import {
  buildShareCardInput,
  pendingSets as pendingSetsOf,
} from "../../lib/workout/shareCardModel";
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
import { SUMMARY_PENDING_LABELS } from "../../lib/i18n";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { WorkoutShareStudio } from "./WorkoutShareStudio";

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
  /** `LISTO` on the share step: the session is closed and the app returns home. */
  onDone: () => void;
}

type SummaryTab = "resumen" | "compartir";

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
  onDone,
}: WorkoutSummaryModalProps) {
  const { weightUnit } = useGymSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<SummaryTab>("resumen");
  /**
   * What the athlete decided about the unchecked rows.
   *
   * `null` means "not asked yet"; the banner is the question. Once answered the
   * numbers below follow that answer and never flip back on a re-render.
   */
  const [includePending, setIncludePending] = useState<boolean | null>(null);

  const pending = useMemo(() => pendingSetsOf(exercises), [exercises]);
  const pendingCount = pending.length;
  // Until the athlete answers, the summary shows the session that was actually
  // checked: promising volume for work nobody marked would be the lie.
  const pendingIncluded = includePending === true;

  const countedExercises = useMemo(() => {
    if (!pendingIncluded) return exercises;
    // Only the rows that were *pending* come back: a row with nothing typed in
    // it is empty, and marking it complete would invent a set.
    const pendingKeys = new Set(pending.map(({ exercise, setNumber }) => `${exercise.key}#${setNumber}`));
    return exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, index) =>
        pendingKeys.has(`${exercise.key}#${index + 1}`) ? { ...set, completed: true } : set,
      ),
    }));
  }, [exercises, pendingIncluded, pending]);

  const totalSets = useMemo(
    () => countedExercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0),
    [countedExercises],
  );
  const totalRows = useMemo(
    () => countedExercises.reduce((n, e) => n + e.sets.length, 0),
    [countedExercises],
  );
  const completedSets = totalSets;
  const totalVolumeKg = useMemo(
    () =>
      countedExercises.reduce(
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
    [countedExercises],
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
      countedExercises.filter((e) =>
        e.sets.some(
          (s) => s.completed && (s.weight && Number.parseFloat(s.weight) > 0),
        ),
      ),
    [countedExercises],
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
        sets: countedExercises.flatMap((e) =>
          e.sets
            .map((s, setIndex) => ({ s, setIndex }))
            .filter(({ s }) => s.completed)
            .map(({ s, setIndex }) => ({
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
  }, [countedExercises, userId, routineId, startedAt, completedAt, onSaved]);

  const shareInput = useMemo(
    () =>
      buildShareCardInput(countedExercises, {
        routineTitle,
        startedAt,
        completedAt,
        includePending: pendingIncluded,
      }),
    [countedExercises, routineTitle, startedAt, completedAt, pendingIncluded],
  );

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
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
            <div role="tablist" aria-label="Secciones del resumen" style={{ display: "flex", gap: SPACE.xs }}>
              {(["resumen", "compartir"] as const).map((value) => {
                const selected = tab === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(value)}
                    style={{
                      minHeight: 36,
                      padding: `0 ${SPACE.sm}px`,
                      borderRadius: RADIUS.pill,
                      border: `1px solid ${selected ? ACCENT.base : GLASS.border}`,
                      background: selected ? ACCENT.subtle : "transparent",
                      color: selected ? TEXT.primary : TEXT.secondary,
                      fontSize: TYPE.caption.size,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: SPACE.xs,
                      cursor: "pointer",
                    }}
                  >
                    {value === "compartir" ? <Share2 size={14} aria-hidden="true" /> : null}
                    {value === "compartir" ? "Compartir ✨" : "Resumen"}
                  </button>
                );
              })}
            </div>
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
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: tab === "compartir" ? 0 : SPACE.md,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.md,
          }}
        >
          {tab === "compartir" ? (
            <WorkoutShareStudio input={shareInput} onDone={onDone} />
          ) : (
            <>
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
              value={`${completedSets} de ${totalRows}`}
              icon={<Check size={18} aria-hidden="true" />}
            />
            <StatCard
              label="Ejercicios"
              value={String(exercises.length)}
              icon={<Flame size={18} aria-hidden="true" />}
            />
          </div>

          {pendingCount > 0 && (
            <div
              role="group"
              aria-label={SUMMARY_PENDING_LABELS.title(pendingCount)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE.sm,
                padding: SPACE.md,
                borderRadius: RADIUS.card,
                border: `1px solid ${ACCENT.border}`,
                background: ACCENT.subtle,
              }}
            >
              <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                {SUMMARY_PENDING_LABELS.title(pendingCount)}
              </p>
              <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
                {includePending === null
                  ? "Decide qué pasa con ellas antes de guardar."
                  : pendingIncluded
                    ? SUMMARY_PENDING_LABELS.included
                    : SUMMARY_PENDING_LABELS.omitted}
              </p>
              <div style={{ display: "flex", gap: SPACE.sm, flexWrap: "wrap" }}>
                <button
                  type="button"
                  aria-pressed={pendingIncluded}
                  onClick={() => setIncludePending(true)}
                  style={{
                    flex: "1 1 auto",
                    minHeight: MOTION.minTouchTarget,
                    padding: `0 ${SPACE.md}px`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${pendingIncluded ? ACCENT.base : GLASS.border}`,
                    background: pendingIncluded ? ACCENT.base : "transparent",
                    color: pendingIncluded ? TEXT.onAccent : TEXT.primary,
                    fontSize: TYPE.caption.size,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✓ {SUMMARY_PENDING_LABELS.include}
                </button>
                <button
                  type="button"
                  aria-pressed={includePending === false}
                  onClick={() => setIncludePending(false)}
                  style={{
                    flex: "1 1 auto",
                    minHeight: MOTION.minTouchTarget,
                    padding: `0 ${SPACE.md}px`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${includePending === false ? ACCENT.base : GLASS.border}`,
                    background: includePending === false ? ACCENT.base : "transparent",
                    color: includePending === false ? TEXT.onAccent : TEXT.primary,
                    fontSize: TYPE.caption.size,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {SUMMARY_PENDING_LABELS.omit}
                </button>
              </div>
            </div>
          )}

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
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {getExerciseDisplayName(e.exercise)}
                      </span>
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
            </>
          )}
        </div>

        {tab === "resumen" && (
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
        )}
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
