/**
 * ExerciseSubstitutionModal.tsx — sustituye un ejercicio por otro del mismo grupo muscular.
 *
 * Lee el catálogo completo (ya en memoria vía `useExerciseCatalog`), filtra por
 * `body_part` del ejercicio actual, excluye el actual, y ofrece alternativas en
 * un modal de vidrio. Al elegir una, el caller reemplaza el ejercicio en la fila
 * de la rutina.
 */

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";

import { MOTION, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import type { Exercise } from "@/types/supabase";

export interface ExerciseSubstitutionModalProps {
  /** El ejercicio que se va a sustituir. */
  current: Exercise;
  /** Todo el catálogo, para buscar alternativas del mismo `body_part`. */
  catalog: Exercise[];
  /** Si el modal está abierto. */
  open: boolean;
  /** Se dispara al elegir un sustituto. */
  onSubstitute: (exercise: Exercise) => void;
  /** Se dispara al cerrar sin elegir. */
  onClose: () => void;
}

export function ExerciseSubstitutionModal({
  current,
  catalog,
  open,
  onSubstitute,
  onClose,
}: ExerciseSubstitutionModalProps) {
  if (!open) return null;

  const alternatives = useMemo(
    () => {
      const target = current.body_part;
      if (!target) return [];
      return catalog
        .filter((e) => e.id !== current.id && e.body_part === target)
        .slice(0, 8);
    },
    [current, catalog],
  );
  const [selected, setSelected] = useState<string | null>(null);

  const choose = useCallback(
    (exercise: Exercise) => {
      setSelected(exercise.id);
      onSubstitute(exercise);
    },
    [onSubstitute],
  );

  return (
    <GlassCard
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        transition: `opacity ${MOTION.fast} ${MOTION.easeOut}`,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-substitution-heading"
        id="exercise-substitution-heading"
        style={{
          maxWidth: 420,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            style={{
              margin: 0,
              fontSize: TYPE.title2.size,
              fontWeight: 700,
              color: TEXT.primary,
            }}
          >
            {T.substituteTitle}
          </h2>
          <button
            type="button"
            aria-label={T.close}
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: TEXT.tertiary,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
            }}
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          {T.substituteByMuscle}
        </p>

        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
          {T.substituteCurrent.replace("{name}", current.name)}
        </p>

        {alternatives.length === 0 ? (
          <p style={bodyStyle}>{T.substituteNoAlternatives}</p>
        ) : (
          <ul className="flex flex-col gap-2" style={listStyle}>
            {alternatives.map((exercise) => (
              <li key={exercise.id}>
                <GlassButton
                  variant={selected === exercise.id ? "primary" : "ghost"}
                  disabled={selected === exercise.id}
                  onClick={() => choose(exercise)}
                >
                  {getExerciseDisplayName(exercise)}
                </GlassButton>
              </li>
            ))}
          </ul>
        )}

        <GlassButton variant="ghost" onClick={onClose}>
          {T.close}
        </GlassButton>
      </section>
    </GlassCard>
  );
}

const bodyStyle = { margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary } as const;
const listStyle = { margin: 0, padding: 0, listStyle: "none" } as const;
