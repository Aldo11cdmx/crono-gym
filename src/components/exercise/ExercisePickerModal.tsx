/**
 * ExercisePickerModal.tsx — selector full-width con mapa anatómico refinado y colapsable.
 *
 * Modal a ancho completo (o drawer responsivo) con fondo oscuro estilo Cronos Gym.
 * Header fijo con búsqueda en tiempo real y botón alternador del mapa anatómico.
 * Filtros por chips scrollables (músculos y equipamiento) y listado memoizado
 * de tarjetas compactas con thumbnail circular vía `useMediaSrc`.
 *
 * Selección instantánea mediante callback `onSelect(exercise)`.
 */

import { memo, useCallback, useMemo, useState } from "react";
import { Search, X, Dumbbell } from "lucide-react";
import type { Slug } from "react-muscle-highlighter";
import type { Exercise } from "@/types/supabase";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { MUSCLE_DEFINITIONS, muscleMatchLevel, type MatchLevel } from "@/lib/muscleMap";
import { MuscleSelector } from "@/components/MuscleSelector";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";

export interface ExercisePickerModalProps {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  /** Heading of the sheet. */
  title?: string;
}

/**
 * A muscle chip can cover several anatomical regions: "Piernas" is quads, hamstrings,
 * glutes and calves, and "Espalda" is the upper back, the lats and the trapezius.
 *
 * The chip therefore carries a list of slugs and the filter is their union, the same
 * rule the library filter uses (a selection is a union of muscles).
 */
interface MuscleChip {
  key: string;
  label: string;
  slugs: Slug[];
}

const MUSCLE_CHIPS: MuscleChip[] = [
  { key: "chest", label: "Pecho", slugs: ["chest"] },
  {
    key: "back",
    label: "Espalda",
    slugs: ["upper-back", "lower-back", "trapezius"],
  },
  { key: "deltoids", label: "Hombros", slugs: ["deltoids"] },
  { key: "triceps", label: "Tríceps", slugs: ["triceps"] },
  { key: "biceps", label: "Bíceps", slugs: ["biceps"] },
  {
    key: "legs",
    label: "Piernas",
    slugs: ["quadriceps", "hamstring", "gluteal", "calves"],
  },
  { key: "abs", label: "Abs", slugs: ["abs", "obliques"] },
];

/**
 * Equipment chips.
 *
 * The catalog stores equipment in English ("dumbbell", "body weight", "leverage
 * machine"), so a chip is a list of tokens rather than a single value: the matcher
 * looks for any of them inside the row's equipment string, which is what makes
 * "olympic barbell" match "Barra" and "leverage machine" match "Máquina".
 *
 * The Spanish spellings are in the list too, because a routine built by hand can
 * carry them and the filter should not silently return nothing for them.
 */
interface EquipmentChip {
  key: string;
  label: string;
  tokens: string[];
}

const EQUIPMENT_CHIPS: EquipmentChip[] = [
  { key: "dumbbell", label: "Mancuernas", tokens: ["dumbbell", "mancuerna", "dumbell"] },
  { key: "barbell", label: "Barra", tokens: ["barbell", "barra"] },
  { key: "cable", label: "Polea", tokens: ["cable", "polea", "rope"] },
  { key: "machine", label: "Máquina", tokens: ["machine", "maquina"] },
  {
    key: "bodyweight",
    label: "Peso Corporal",
    tokens: ["body weight", "bodyweight", "peso corporal", "weighted"],
  },
];

/** Lowercase, accent-free, so "Máquina" and "maquina" are the same token. */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function equipmentMatches(exercise: Exercise, tokens: string[]): boolean {
  const equipment = normalise(exercise.equipment ?? "");
  if (equipment === "") return false;
  return tokens.some((token) => equipment.includes(token));
}

/**
 * The muscles an exercise works, best first.
 *
 * `muscleMatchLevel` is the app's own notion of primary (the catalog's `target`) and
 * secondary (the region it lives in), so the badge says the same thing the ranks
 * engine says rather than a second, slightly different taxonomy.
 */
function muscleBadges(exercise: Exercise): { label: string; level: MatchLevel }[] {
  const found: { label: string; level: MatchLevel }[] = [];
  for (const def of MUSCLE_DEFINITIONS) {
    const level = muscleMatchLevel(exercise, def.slug);
    if (!level) continue;
    found.push({ label: def.label, level });
  }
  const rank = (level: MatchLevel) => (level === "primary" ? 0 : 1);
  return found.sort((a, b) => rank(a.level) - rank(b.level)).slice(0, 2);
}

export function ExercisePickerModal({
  open,
  onClose,
  exercises,
  onSelect,
  title = "Selector de ejercicios",
}: ExercisePickerModalProps) {
  const [query, setQuery] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<Slug[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = normalise(query);
    const result = exercises.filter((ex) => {
      // The card shows the Spanish display name, so that is what the query has
      // to match; the catalog name stays as a second chance.
      if (
        q &&
        !normalise(ex.name).includes(q) &&
        !normalise(getExerciseDisplayName(ex)).includes(q)
      ) {
        return false;
      }
      if (selectedMuscles.length > 0) {
        const matched = selectedMuscles.some(
          (slug) => muscleMatchLevel(ex, slug) !== null,
        );
        if (!matched) return false;
      }
      if (selectedEquipment !== "all") {
        const chip = EQUIPMENT_CHIPS.find((c) => c.key === selectedEquipment);
        if (chip && !equipmentMatches(ex, chip.tokens)) return false;
      }
      return true;
    });
    return result.sort((a, b) =>
      getExerciseDisplayName(a).localeCompare(getExerciseDisplayName(b), "es"),
    );
  }, [exercises, query, selectedMuscles, selectedEquipment]);

  const handleSelect = useCallback(
    (exercise: Exercise) => {
      onSelect(exercise);
    },
    [onSelect],
  );

  const toggleMuscleChip = useCallback((chip: MuscleChip) => {
    setSelectedMuscles((prev) => {
      const active = chip.slugs.filter((slug) => prev.includes(slug));
      if (active.length === 0) {
        return [...prev, ...chip.slugs];
      }
      // Clicking an active chip clears the whole group it stands for.
      return prev.filter((slug) => !chip.slugs.includes(slug));
    });
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "100%",
          height: "92vh",
          maxHeight: "92vh",
          borderRadius: 0,
          background: SURFACE.raised,
          border: "none",
          boxShadow: GLASS.shadow,
          overflow: "hidden",
        }}
      >
        {/* Header fijo */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.sm,
            padding: `${SPACE.sm} ${SPACE.md}`,
            borderBottom: `1px solid ${GLASS.border}`,
            background: GLASS.fillRaised,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <Search
                style={{
                  position: "absolute",
                  left: SPACE.xs,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 16,
                  height: 16,
                  color: TEXT.tertiary,
                }}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ejercicio…"
                aria-label="Buscar ejercicio"
                style={{
                  width: "100%",
                  minHeight: MOTION.minTouchTarget,
                  paddingLeft: 36,
                  paddingRight: 32,
                  borderRadius: RADIUS.input,
                  border: `1px solid ${GLASS.border}`,
                  background: "transparent",
                  color: TEXT.primary,
                  fontSize: TYPE.body.size,
                  fontFamily: "inherit",
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  style={{
                    position: "absolute",
                    right: SPACE.xs,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: TEXT.tertiary,
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: RADIUS.sm,
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMapOpen((m) => !m)}
              aria-pressed={mapOpen}
              aria-label={mapOpen ? "Ocultar mapa anatómico" : "Mostrar mapa anatómico"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: SPACE.xs,
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.sm}`,
                borderRadius: RADIUS.control,
                border: `1px solid ${mapOpen ? ACCENT.base : GLASS.border}`,
                background: mapOpen ? ACCENT.subtle : "transparent",
                color: mapOpen ? ACCENT.text : TEXT.primary,
                fontSize: TYPE.caption.size,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              🧍 Mapa Anatómico
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
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
        </header>

        {/* Mapa anatómico (colapsable) */}
        {mapOpen && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.xs,
              padding: SPACE.sm,
              borderBottom: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              maxHeight: "46vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: TYPE.caption.size,
                fontWeight: TYPE.caption.weight,
                letterSpacing: TYPE.caption.tracking,
                textTransform: "uppercase",
                color: TEXT.secondary,
                marginLeft: SPACE.xs,
              }}
            >
              Filtrar por músculo
            </div>
            <MuscleSelector
              selected={selectedMuscles}
              onChange={setSelectedMuscles}
            />
          </div>
        )}

        {/* Filtros por chips scrollables */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.xs,
            padding: `${SPACE.sm} ${SPACE.md}`,
            borderBottom: `1px solid ${GLASS.border}`,
            background: GLASS.fillRaised,
            overflowX: "hidden",
          }}
        >
          <div
            style={{
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              letterSpacing: TYPE.caption.tracking,
              textTransform: "uppercase",
              color: TEXT.secondary,
            }}
          >
            Músculos
          </div>
          <div
            style={{
              display: "flex",
              gap: SPACE.xs,
              overflowX: "auto",
              paddingBottom: SPACE.xs,
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {MUSCLE_CHIPS.map((chip) => {
              const active = chip.slugs.some((slug) => selectedMuscles.includes(slug));
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMuscleChip(chip)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: SPACE.xs,
                    minHeight: 30,
                    padding: `0 ${SPACE.sm}`,
                    borderRadius: RADIUS.pill,
                    border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                    background: active ? ACCENT.base : "transparent",
                    color: active ? TEXT.onAccent : TEXT.secondary,
                    fontSize: TYPE.caption.size,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              fontSize: TYPE.caption.size,
              fontWeight: TYPE.caption.weight,
              letterSpacing: TYPE.caption.tracking,
              textTransform: "uppercase",
              color: TEXT.secondary,
              marginTop: SPACE.xs,
            }}
          >
            Equipamiento
          </div>
          <div
            style={{
              display: "flex",
              gap: SPACE.xs,
              overflowX: "auto",
              paddingBottom: SPACE.xs,
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {EQUIPMENT_CHIPS.map((chip) => {
              const active = selectedEquipment === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedEquipment((prev) => (prev === chip.key ? "all" : chip.key))
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: SPACE.xs,
                    minHeight: 30,
                    padding: `0 ${SPACE.sm}`,
                    borderRadius: RADIUS.pill,
                    border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                    background: active ? ACCENT.base : "transparent",
                    color: active ? TEXT.onAccent : TEXT.secondary,
                    fontSize: TYPE.caption.size,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Listado de ejercicios */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: SPACE.md,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: TYPE.caption.size,
                color: TEXT.secondary,
              }}
            >
              {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: SPACE.sm,
            }}
          >
            {filtered.map((exercise) => (
              <PickerCard
                key={exercise.id}
                exercise={exercise}
                onSelect={handleSelect}
              />
            ))}
            {filtered.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: SPACE.lg,
                  color: TEXT.tertiary,
                  fontSize: TYPE.caption.size,
                }}
              >
                Sin resultados
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One compact exercise card.
 *
 * Memoised on purpose: the list can hold a thousand rows and the parent re-renders
 * on every keystroke in the search box, so a card that re-rendered with it would
 * re-run its own image resolution for every visible row.
 */
const PickerCard = memo(function PickerCard({
  exercise,
  onSelect,
}: {
  exercise: Exercise;
  onSelect: (exercise: Exercise) => void;
}) {
  const media = useMemo(
    () => resolveMedia("exercise-gif", exercise.id, exercise.gif_url),
    [exercise.id, exercise.gif_url],
  );
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const badges = useMemo(() => muscleBadges(exercise), [exercise]);
  const name = getExerciseDisplayName(exercise);

  return (
    <button
      type="button"
      data-testid="exercise-picker-card"
      onClick={() => onSelect(exercise)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE.xs,
        padding: SPACE.sm,
        borderRadius: RADIUS.card,
        border: `1px solid ${GLASS.border}`,
        background: GLASS.fillRaised,
        color: TEXT.primary,
        cursor: "pointer",
        textAlign: "left",
        transition: `border-color ${MOTION.fast} ${MOTION.standard}`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: RADIUS.round,
          background: GLASS.fill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: `1px solid ${GLASS.border}`,
        }}
      >
        {src !== "" && !failed ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            onLoad={onLoad}
            onError={onError}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: RADIUS.round,
              objectFit: "cover",
            }}
          />
        ) : (
          <Dumbbell size={18} strokeWidth={1.5} aria-hidden="true" />
        )}
      </div>
      <span
        style={{
          fontSize: TYPE.caption.size,
          fontWeight: TYPE.caption.weight,
          color: TEXT.secondary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
        title={name}
      >
        {name}
      </span>
      {badges.length > 0 && (
        <span style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
          {badges.map((badge) => (
            <span
              key={`${badge.label}-${badge.level}`}
              style={{
                fontSize: TYPE.label.size,
                fontWeight: TYPE.label.weight,
                letterSpacing: TYPE.label.tracking,
                color: badge.level === "primary" ? ACCENT.text : TEXT.tertiary,
                background:
                  badge.level === "primary" ? ACCENT.subtle : GLASS.fill,
                borderRadius: RADIUS.sm,
                padding: "1px 6px",
              }}
            >
              {badge.label}
            </span>
          ))}
        </span>
      )}
    </button>
  );
});
