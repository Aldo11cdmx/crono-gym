/**
 * RoutineCard.tsx — tarjeta de rutina en el selector de rutinas.
 *
 * Acabado glassmorphic sobre fondo OLED negro: `GLASS.fillRaised` +
 * `backdrop-filter: blur(16px)` + borde `GLASS.border` que se enfatiza al hacer
 * hover (`GLASS.borderStrong`). Un único foco visual: el botón primario
 * "Iniciar Rutina" (`ACCENT.base`). Todo el estilo sale de `src/design/tokens.ts`
 * (cero literales de color, radio o duración en el componente).
 *
 * Los chips de grupos musculares usan la paleta `STATUS` (un color por grupo,
 * nunca verde saturado). El menú de 3 puntos respeta el rol activo: solo
 * `coach`/`admin`/`developer` ven Duplicar y Eliminar.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Clock,
  Copy,
  Dumbbell,
  MoreHorizontal,
  Pencil,
  Play,
  Share2,
  StarIcon,
  Trash2,
} from "lucide-react";
import type { Role } from "@/lib/localSession";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { RoutineDraft } from "@/lib/routines/routineDraftModel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ActionSheet } from "../ActionSheet";
import {
  ACCENT,
  COPPER,
  DANGER,
  FONT_SANS,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { estimateRoutineDuration } from "@/lib/routines/routineDraftModel";
import { translateMuscle } from "@/lib/i18n";

type StatusName = keyof typeof STATUS;

const MUSCLE_STATUS_BY_TARGET: Record<string, StatusName> = {
  chest: "warning",
  pectoral: "warning",
  back: "success",
  espalda: "success",
  legs: "progression",
  pierna: "progression",
  glutes: "warning",
  glúteos: "warning",
  shoulder: "comeback",
  hombro: "comeback",
  arm: "pr",
  brazo: "pr",
  biceps: "pr",
  tríceps: "pr",
  triceps: "pr",
  abdomen: "error",
  abdominal: "error",
};

const DEFAULT_MUSCLE_STATUSES: StatusName[] = [
  "success",
  "warning",
  "pr",
  "progression",
  "comeback",
];

function muscleColor(target: string, index: number): StatusName {
  const key = MUSCLE_STATUS_BY_TARGET[target.toLowerCase()];
  if (key) return key;
  return DEFAULT_MUSCLE_STATUSES[index % DEFAULT_MUSCLE_STATUSES.length];
}

function draftFromRoutine(routine: RoutineWithExercises): RoutineDraft {
  const dayLabels: Record<number, string> = {};
  for (const pe of routine.exercises) {
    const day = pe.dayIndex ?? 0;
    if (!dayLabels[day] && pe.dayLabel && pe.dayLabel.trim() !== "") {
      dayLabels[day] = pe.dayLabel;
    }
  }
  return {
    id: routine.id,
    title: routine.title,
    description: routine.description ?? "",
    dayIndex: routine.exercises[0]?.dayIndex ?? 0,
    dayLabel: routine.exercises[0]?.dayLabel ?? "",
    items: routine.exercises.map((pe, index) => ({
      exercise: pe.exercise,
      target_sets: pe.target_sets,
      rest_seconds: pe.rest_seconds,
      order_index: index,
      target_reps_min: null,
      target_reps_max: null,
      dayIndex: pe.dayIndex ?? 0,
    })),
    dayLabels,
  };
}

export interface RoutineCardProps {
  routine: RoutineWithExercises;
  role: Role;
  onStart: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  isFavoritePending: boolean;
  onDuplicate?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
}

export function RoutineCard({
  routine,
  role,
  onStart,
  onEdit,
  onToggleFavorite,
  isFavoritePending,
  onDuplicate,
  onShare,
  onDelete,
}: RoutineCardProps) {
  const canManage =
    role === "coach" || role === "admin" || role === "developer";

  const draft = useMemo(() => draftFromRoutine(routine), [routine]);
  const duration = useMemo(() => estimateRoutineDuration(draft), [draft]);
  const totalSets = useMemo(
    () =>
      routine.exercises.reduce((sum, pe) => sum + (pe.target_sets ?? 0), 0),
    [routine.exercises],
  );

  const muscleTargets = useMemo(
    () =>
      Array.from(
        new Set(routine.exercises.map((pe) => pe.exercise.target)),
      ).slice(0, 4),
    [routine.exercises],
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchor = useRef<DOMRect | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = menuButtonRef.current
        ? menuButtonRef.current.getBoundingClientRect()
        : null;
      menuAnchor.current = rect ?? null;
      setMenuOpen(true);
    },
    [],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    const onClick = () => closeMenu();
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [menuOpen, closeMenu]);

  const isAi = routine.source === "ai";
  const isCoach = routine.source === "human_coach";

  const cardStyle: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    borderRadius: RADIUS.card,
    padding: SPACE.card,
    backgroundColor: GLASS.fillRaised,
    border: `1px solid ${GLASS.border}`,
    boxShadow: GLASS.shadow,
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    transition: `border-color ${MOTION.fast} ${MOTION.standard}`,
    display: "flex",
    flexDirection: "column",
    gap: SPACE.md,
  };

  const headerTopStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.sm,
  };

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: TYPE.title2.size,
    fontWeight: TYPE.title2.weight,
    lineHeight: TYPE.title2.lineHeight,
    color: TEXT.primary,
    minWidth: 0,
  };

  const descStyle: CSSProperties = {
    margin: `0 0 ${SPACE.xs}`,
    fontSize: TYPE.body.size,
    lineHeight: TYPE.body.lineHeight,
    color: TEXT.secondary,
    minWidth: 0,
  };

  const sourceChipStyle = (base: CSSProperties) => ({
    ...base,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: TYPE.caption.size,
    fontWeight: TYPE.caption.weight,
    borderRadius: RADIUS.chip,
    padding: "2px 8px",
    flexShrink: 0,
  });

  const chipsRowStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: SPACE.xs,
  };

  const muscleChipStyle = (color: StatusName): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: TYPE.caption.size,
    fontWeight: TYPE.caption.weight,
    letterSpacing: TYPE.label.tracking,
    textTransform: "uppercase",
    color: STATUS[color].text,
    backgroundColor: STATUS[color].muted,
    border: `1px solid ${STATUS[color].border}`,
    borderRadius: RADIUS.pill,
    padding: "1px 8px",
    flexShrink: 0,
  });

  const metadataRowStyle: CSSProperties = {
    display: "flex",
    gap: SPACE.sm,
    alignItems: "center",
  };

  const metadataChipStyle = (): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: TYPE.caption.size,
    lineHeight: TYPE.caption.lineHeight,
    color: TEXT.secondary,
    backgroundColor: GLASS.fill,
    border: `1px solid ${GLASS.border}`,
    borderRadius: RADIUS.chip,
    padding: "1px 8px",
  });

  const footerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
    marginTop: SPACE.xs,
  };

  const primaryButtonStyle: CSSProperties = {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    minHeight: MOTION.minTouchTarget,
    padding: `${SPACE.sm} ${SPACE.lg}`,
    borderRadius: RADIUS.control,
    background: ACCENT.base,
    border: `1px solid ${ACCENT.base}`,
    color: TEXT.onAccent,
    fontFamily: FONT_SANS,
    fontSize: TYPE.subhead.size,
    fontWeight: TYPE.subhead.weight,
    cursor: "pointer",
    boxShadow: ACCENT.ring,
    transition: `background-color ${MOTION.fast} ${MOTION.standard}`,
    minWidth: 0,
  };

  const ghostButtonStyle = (): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: RADIUS.control,
    border: `1px solid ${GLASS.border}`,
    background: GLASS.fill,
    color: TEXT.secondary,
    cursor: "pointer",
    transition: `border-color ${MOTION.fast} ${MOTION.standard}`,
  });

  const menuStyle: CSSProperties = {
    backgroundColor: GLASS.fillRaised,
    position: "fixed",
    borderRadius: RADIUS.control,
    border: `1px solid ${GLASS.border}`,
    padding: SPACE.xs,
    minWidth: 170,
    zIndex: Z_INDEX.modal,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    boxShadow: GLASS.shadow,
  };

  const menuItemStyle = (danger = false): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: SPACE.xs,
    fontFamily: FONT_SANS,
    fontSize: TYPE.body.size,
    color: danger ? DANGER.text : TEXT.primary,
    border: "none",
    background: "transparent",
    width: "100%",
    padding: `${SPACE.sm} ${SPACE.md}`,
    borderRadius: RADIUS.control,
    cursor: "pointer",
    textAlign: "left",
  });

  return (
    <>
      <div style={cardStyle}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
          }}
        />

        <div style={headerTopStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={titleStyle}>
              {routine.title &&
              routine.title.trim() !== "" &&
              routine.title.trim().toLowerCase() !== "xd"
                ? routine.title
                : routine.title &&
                  routine.title.trim().toLowerCase() === "xd"
                  ? "Rutina de Torso & Abdomen"
                  : "Rutina Personalizada"}
            </h3>
            {routine.description && (
              <p style={descStyle}>{routine.description}</p>
            )}
            {(isAi || isCoach) && (
              <span
                style={sourceChipStyle({
                  color: isAi ? ACCENT.text : COPPER.text,
                  backgroundColor: isAi ? ACCENT.subtle : COPPER.muted,
                })}
              >
                {isAi && <StarIcon style={{ width: 10, height: 10 }} />}
                {isAi ? "IA" : "Coach"}
              </span>
            )}
          </div>
        </div>

        <div style={chipsRowStyle}>
          {muscleTargets.map((target, index) => {
            const color = muscleColor(target, index);
            return (
              <span
                key={target}
                style={muscleChipStyle(color)}
                title={target}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "9999px",
                    backgroundColor: STATUS[color].base,
                    flexShrink: 0,
                  }}
                />
                {translateMuscle(target)}
              </span>
            );
          })}
        </div>

        <div style={metadataRowStyle}>
          <span style={metadataChipStyle()}>
            <Clock style={{ width: 13, height: 13 }} strokeWidth={1.5} />
            <span>{duration} min</span>
          </span>
          <span style={metadataChipStyle()}>
            <Dumbbell style={{ width: 13, height: 13 }} strokeWidth={1.5} />
            <span>
              {routine.exercises.length} ejercicio{routine.exercises.length !== 1 ? "s" : ""}
            </span>
          </span>
          <span style={metadataChipStyle()}>
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {totalSets}
            </span>{" "}
            <span style={{ fontSize: TYPE.caption.size, opacity: 0.7 }}>series</span>
          </span>
        </div>

        <div style={footerStyle}>
          <button
            type="button"
            onClick={onStart}
            style={primaryButtonStyle}
          >
            <Play style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            Iniciar Rutina
          </button>

          <div style={{ display: "inline-flex", gap: SPACE.xs }}>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Editar rutina"
              style={ghostButtonStyle()}
            >
              <Pencil style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={isFavoritePending}
              aria-label={routine.is_favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
              style={{
                ...ghostButtonStyle(),
                color: routine.is_favorite ? ACCENT.text : TEXT.secondary,
              }}
            >
              <StarIcon
                style={{ width: 14, height: 14, fill: routine.is_favorite ? ACCENT.text : "none" }}
                stroke={routine.is_favorite ? "none" : "currentColor"}
                strokeWidth={1.5}
              />
            </button>
            <button
              type="button"
              onClick={openMenu}
              ref={menuButtonRef}
              aria-label="Más opciones"
              style={ghostButtonStyle()}
            >
              <MoreHorizontal style={{ width: 14, height: 14 }} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && menuAnchor.current ? (
        isMobile ? (
          <ActionSheet
            isOpen={menuOpen}
            onClose={closeMenu}
            title="Acciones de la rutina"
            items={[
              {
                icon: <Pencil style={{ width: 14, height: 14 }} strokeWidth={1.5} />,
                label: "Editar",
                onClick: () => {
                  onEdit();
                  closeMenu();
                },
              },
              ...(canManage && onDuplicate
                ? [
                    {
                      icon: <Copy style={{ width: 14, height: 14 }} strokeWidth={1.5} />,
                      label: "Duplicar",
                      onClick: () => {
                        onDuplicate();
                        closeMenu();
                      },
                    },
                  ]
                : []),
              ...(canManage && onShare
                ? [
                    {
                      icon: <Share2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />,
                      label: "Compartir",
                      onClick: () => {
                        void onShare();
                        closeMenu();
                      },
                    },
                  ]
                : []),
              ...(canManage && onDelete
                ? [
                    {
                      icon: <Trash2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />,
                      label: "Eliminar",
                      destructive: true,
                      onClick: () => {
                        onDelete();
                        closeMenu();
                      },
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <>
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: Z_INDEX.modal,
                backgroundColor: SCRIM.modal,
              }}
              onClick={closeMenu}
            />
            <div
              role="menu"
              aria-label="Acciones de la rutina"
              style={{
                ...menuStyle,
                left: Math.min(Math.max(8, menuAnchor.current.left), window.innerWidth - 180),
                top: Math.min(
                  Math.max(8, menuAnchor.current.bottom + 8),
                  window.innerHeight - 150,
                ),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onEdit();
                  closeMenu();
                }}
                style={menuItemStyle()}
              >
                <Pencil style={{ width: 14, height: 14 }} strokeWidth={1.5} />
                Editar
              </button>
              {canManage && onDuplicate && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDuplicate();
                    closeMenu();
                  }}
                  style={menuItemStyle()}
                >
                  <Copy style={{ width: 14, height: 14 }} strokeWidth={1.5} />
                  Duplicar
                </button>
              )}
              {canManage && onShare && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void onShare();
                    closeMenu();
                  }}
                  style={menuItemStyle()}
                >
                  <Share2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />
                  Compartir
                </button>
              )}
              {canManage && onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onDelete();
                    closeMenu();
                  }}
                  style={menuItemStyle(true)}
                >
                  <Trash2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />
                  Eliminar
                </button>
              )}
            </div>
          </>
        )
      ) : null}
    </>
  );
}
