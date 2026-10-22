/**
 * ExerciseSwapModal.tsx — modal for replacing an exercise with a same-muscle
 * alternative.
 *
 * Opens from the "Cambiar" button on an `ExerciseRow`. Shows a ranked list of
 * candidates filtered by primary or secondary muscle, with equipment
 * availability tagged so the user can see at a glance what they can actually
 * perform. Selecting a candidate replaces the exercise immutably; the caller
 * preserves sets, reps and rest.
 *
 * Token-only styling — no hex/rgba literals, no `linear` keyword in CSS-in-JS.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeftRight, X, Dumbbell } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import type { DraftExercise } from "@/lib/routines/routineDraftModel";
import { getExerciseName, getRepLabel } from "@/lib/routines/routineDraftModel";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { translateBodyPart, translateEquipment, translateTarget } from "@/lib/i18n";
import {
  findSwapCandidates,
  type SwapCandidate,
} from "@/lib/routines/exerciseSwap";
import {
  ACCENT,
  FONT_SANS,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SOLID,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";

const OVERLAY_STYLE: CSSProperties = {
  backgroundColor: SCRIM.modal,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const SURFACE_STYLE: CSSProperties = {
  backgroundColor: GLASS.fill,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

const SURFACE_RAISED: CSSProperties = {
  backgroundColor: SOLID.popover,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

export interface ExerciseSwapModalProps {
  isOpen: boolean;
  source: DraftExercise;
  allExercises: Exercise[];
  availableEquipment?: ReadonlySet<string>;
  onReplace: (replacement: Exercise) => void;
  onDismiss: () => void;
}

export function ExerciseSwapModal({
  isOpen,
  source,
  allExercises,
  availableEquipment,
  onReplace,
  onDismiss,
}: ExerciseSwapModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    if (isOpen) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [isOpen, onDismiss]);

  const candidates = useMemo(() => {
    if (!isOpen) return [] as SwapCandidate[];
    return findSwapCandidates(source.exercise, {
      allExercises,
      availableEquipment,
      excludeId: source.exercise.id,
    });
  }, [isOpen, source.exercise, allExercises, availableEquipment]);

  const filtered = useMemo(() => {
    if (query.trim() === "") return candidates;
    const lower = query.toLowerCase();
    return candidates.filter(
      (c) =>
        // The card shows the Spanish name, so the query has to match it; the
        // catalog name stays as a second chance.
        c.exercise.name.toLowerCase().includes(lower) ||
        getExerciseDisplayName(c.exercise).toLowerCase().includes(lower) ||
        translateBodyPart(c.exercise.body_part).toLowerCase().includes(lower) ||
        translateTarget(c.exercise.target).toLowerCase().includes(lower),
    );
  }, [candidates, query]);

  const handleSelect = useCallback(
    (replacement: Exercise) => {
      onReplace(replacement);
      onDismiss();
    },
    [onReplace, onDismiss],
  );

  if (!isOpen) return null;

  const matchLabel = (c: SwapCandidate): string =>
    c.primaryMatch
      ? `Mismo músculo: ${translateBodyPart(c.exercise.body_part)}`
      : `Mismo objetivo: ${translateTarget(c.exercise.target)}`;

  return (
    <div
      style={{
        ...OVERLAY_STYLE,
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE.gutter,
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          ...SURFACE_RAISED,
          borderRadius: RADIUS.modal,
          maxWidth: 420,
          width: "100%",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          animation: `slideUp ${MOTION.slow}ms ${MOTION.standard}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: `${SPACE.sm} ${SPACE.md}`,
            borderBottom: `1px solid ${GLASS.border}`,
            display: "flex",
            alignItems: "center",
            gap: SPACE.sm,
          }}
        >
          <ArrowLeftRight
            style={{ width: 16, height: 16, color: ACCENT.text }}
            strokeWidth={1.5}
          />
          <h3
            style={{
              fontSize: TYPE.title1.size,
              fontWeight: TYPE.title1.weight,
              color: TEXT.primary,
              margin: 0,
              flex: 1,
            }}
          >
            Cambiar ejercicio
          </h3>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: RADIUS.chip,
              border: "none",
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
          >
            <X style={{ width: 12, height: 12 }} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: `${SPACE.sm} ${SPACE.md}` }}>
          <div
            style={{
              position: "relative",
              marginBottom: SPACE.sm,
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ejercicio…"
              style={{
                width: "100%",
                padding: `${SPACE.sm} ${SPACE.md}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                background: SOLID.card,
                color: TEXT.primary,
                fontSize: TYPE.body.size,
              }}
            />
            <Dumbbell
              style={{
                position: "absolute",
                left: SPACE.sm,
                top: "50%",
                marginTop: -8,
                width: 14,
                height: 14,
                color: TEXT.tertiary,
              }}
              strokeWidth={1.5}
            />
          </div>

          <div style={{ marginBottom: SPACE.sm }}>
            <span
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.secondary,
                fontFamily: FONT_SANS,
              }}
            >
              {getExerciseName(source.exercise)} · {getRepLabel(source)} ·{" "}
              {translateEquipment(source.exercise.equipment)}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div
              style={{
                padding: SPACE.md,
                textAlign: "center",
                color: TEXT.tertiary,
                fontSize: TYPE.caption.size,
              }}
            >
              <Dumbbell
                style={{
                  width: 32,
                  height: 32,
                  color: TEXT.tertiary,
                  margin: "0 auto 8px",
                }}
                strokeWidth={1.5}
              />
              Sin alternativas encontradas para este músculo.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SPACE.xs,
                maxHeight: "calc(80vh - 140px)",
                overflowY: "auto",
              }}
            >
              {filtered.map((c) => (
                <button
                  key={c.exercise.id}
                  type="button"
                  onClick={() => handleSelect(c.exercise)}
                  style={{
                    ...SURFACE_STYLE,
                    borderRadius: RADIUS.control,
                    padding: SPACE.sm,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: SPACE.xs,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: TYPE.body.size,
                          fontWeight: TYPE.body.weight,
                          color: TEXT.primary,
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {getExerciseName(c.exercise)}
                      </span>
                      <span
                        style={{
                          fontSize: TYPE.caption.size,
                          color: TEXT.secondary,
                          display: "flex",
                          gap: "4px",
                          flexWrap: "wrap",
                          marginTop: 2,
                        }}
                      >
                        {translateEquipment(c.exercise.equipment)}
                        {" · "}
                        {matchLabel(c)}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: TYPE.caption.size,
                        color: c.equipmentAvailable ? ACCENT.text : TEXT.tertiary,
                        fontFamily: FONT_SANS,
                        flexShrink: 0,
                        marginLeft: SPACE.sm,
                      }}
                    >
                      {c.equipmentAvailable ? "Disponible" : "No disponible"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SwapButton({
  onClick,
}: {
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const btnStyle: CSSProperties = useMemo(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: RADIUS.chip,
      border: "none",
      background: "transparent",
      color: hover ? TEXT.primary : TEXT.secondary,
      cursor: "pointer",
      transition: `color ${MOTION.fast} ${MOTION.standard}`,
    }),
    [hover],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cambiar ejercicio"
      title="Cambiar ejercicio"
      style={btnStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <ArrowLeftRight style={{ width: 14, height: 14 }} strokeWidth={1.5} />
    </button>
  );
}
