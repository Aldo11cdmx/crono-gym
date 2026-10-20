/**
 * ExerciseSelectorModal.tsx — selector de ejercicios para el entrenamiento activo.
 *
 * Lee el catálogo de `src/data/exercisesCatalog.json`, filtra por búsqueda y por
 * el toggle "Solo Cronos Gym" (activado por defecto: `availableInCronosGym ===
 * true`) y renderiza la lista con virtualización de `itemHeight` fijo, de modo
 * que el scroll sobre los 1.135 ejercicios disponibles se mantenga a 60 FPS.
 *
 * Cada tarjeta muestra: miniatura GIF (48 × 48 px), nombre + grupo muscular y un
 * chip con la foto HD de la máquina asignada (CG-EQP-XXXX). Al tocar una
 * tarjeta se invoca `onSelect` con el ejercicio elegido.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { X, Search, Dumbbell } from "lucide-react";
import { getEquipmentSuggestionForExercise } from "@/data/equipmentCatalog";
import exercisesCatalog from "@/data/exercisesCatalog.json";
import { translateBodyPart } from "@/lib/i18n";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  SURFACE_ROLE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";

interface CatalogExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  gif_url: string;
  image: string;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  availableInCronosGym: boolean;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
  media_id: string;
  created_at: string;
  attribution: string | null;
}

export interface ExerciseSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: CatalogExercise) => void;
}

const ITEM_HEIGHT = 112;
const THUMB_SIZE = 48;

function resolveImageSrc(src: string): string {
  return src.replace(/^public\//, "/");
}

function ExerciseSelectorModal({
  open,
  onClose,
  onSelect,
}: ExerciseSelectorModalProps) {
  const [query, setQuery] = useState("");
  const [onlyCronos, setOnlyCronos] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const catalog = exercisesCatalog as CatalogExercise[];

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return catalog.filter((ex) => {
      if (onlyCronos && ex.availableInCronosGym !== true) return false;
      return q === "" || ex.name.toLowerCase().includes(q);
    });
  }, [catalog, query, onlyCronos]);

  const suggestions = useMemo(
    () =>
      new Map(
        filtered.map((ex) => [
          ex.id,
          getEquipmentSuggestionForExercise(ex.name, ex.equipment),
        ]),
      ),
    [filtered],
  );

  const visibleCount = Math.ceil(Math.max(listRef.current?.clientHeight ?? 336, 336) / ITEM_HEIGHT) + 2;
  const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 1);
  const end = Math.min(filtered.length, start + visibleCount);
  const offset = start * ITEM_HEIGHT;

  const handleSelect = useCallback(
    (ex: CatalogExercise) => {
      onSelect(ex);
      onClose();
    },
    [onClose, onSelect],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar ejercicio"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: SCRIM.modal,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "min(92vw, 520px)",
          maxHeight: "88vh",
          borderRadius: RADIUS.modal,
          background: SOLID.popover,
          border: `1px solid ${GLASS.borderStrong}`,
          boxShadow: GLASS.shadow,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
            padding: `${SPACE.md} ${SPACE.lg}`,
            borderBottom: `1px solid ${GLASS.border}`,
            background: SURFACE_ROLE.card,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: TYPE.title2.size,
                fontWeight: TYPE.title2.weight,
                color: TEXT.primary,
              }}
            >
              Seleccionar ejercicio
            </h2>
            <p
              style={{
                margin: `0 0 ${SPACE.xs}`,
                fontSize: TYPE.caption.size,
                color: TEXT.secondary,
              }}
            >
              {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}
            </p>
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
              padding: `0 ${SPACE.sm}`,
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Barra de herramientas: búsqueda + toggle Solo Cronos Gym */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE.sm,
            padding: SPACE.sm,
            borderBottom: `1px solid ${GLASS.border}`,
            background: GLASS.fill,
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              minWidth: 0,
            }}
          >
            <Search
              style={{
                position: "absolute",
                left: SPACE.sm,
                top: "50%",
                transform: "translateY(-50%)",
                color: TEXT.tertiary,
                width: TYPE.body.size,
                height: TYPE.body.size,
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ejercicio…"
              style={{
                width: "100%",
                minHeight: MOTION.minTouchTarget,
                padding: `0 ${SPACE.sm} 0 ${SPACE.md}`,
                borderRadius: RADIUS.input,
                border: `1px solid ${GLASS.border}`,
                background: SURFACE_ROLE.well,
                color: TEXT.primary,
                fontSize: TYPE.body.size,
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE.xs,
              cursor: "pointer",
              fontSize: TYPE.caption.size,
              color: TEXT.primary,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={onlyCronos}
              onChange={() => setOnlyCronos((v) => !v)}
              style={{
                width: 40,
                height: 20,
                borderRadius: 10,
                background: onlyCronos ? ACCENT.base : GLASS.border,
                border: "none",
                appearance: "none",
                position: "relative",
                cursor: "pointer",
                outline: "none",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 2,
                top: 1,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: TEXT.primary,
                transform: `translateX(${onlyCronos ? 20 : 0}px)`,
                transition: `transform ${MOTION.fast} ${MOTION.standard}`,
              }}
              aria-hidden="true"
            />
            <span>Solo Cronos Gym</span>
          </label>
        </div>

        {/* Lista virtualizada */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            position: "relative",
          }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div style={{ height: filtered.length * ITEM_HEIGHT, position: "relative" }}>
                  {filtered.slice(start, end).map((ex, i) => {
              const suggestion = suggestions.get(ex.id);
              const primary = suggestion?.primary ?? null;
              const machineImg = primary?.views?.[0]?.src;
              return (
                <div
                  key={ex.id}
                  style={{
                    position: "absolute",
                    top: (start + i) * ITEM_HEIGHT - offset,
                    left: 0,
                    right: 0,
                    height: ITEM_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    gap: SPACE.md,
                    padding: `${SPACE.xs} ${SPACE.sm}`,
                    borderBottom: `1px solid ${GLASS.border}`,
                    background: SURFACE_ROLE.card,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = SOLID.popover;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = SURFACE_ROLE.card;
                  }}
                  onClick={() => handleSelect(ex)}
                  role="option"
                  aria-label={ex.name}
                >
                  {/* Miniatura GIF 48 × 48 */}
                  <div
                    style={{
                      width: THUMB_SIZE,
                      height: THUMB_SIZE,
                      flexShrink: 0,
                      borderRadius: RADIUS.sm,
                      overflow: "hidden",
                      background: SURFACE_ROLE.well,
                      border: `1px solid ${GLASS.border}`,
                    }}
                  >
                    {ex.gif_url ? (
                      <img
                        src={resolveImageSrc(ex.gif_url)}
                        alt={`Animación de ${ex.name}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                        onError={(ev) => {
                          (ev.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}
                    {!ex.gif_url && (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: TEXT.tertiary,
                        }}
                      >
                        <Dumbbell style={{ width: 20, height: 20 }} aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: TYPE.body.size,
                        fontWeight: 600,
                        color: TEXT.primary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ex.name}
                    </div>
                    <div
                      style={{
                        fontSize: TYPE.caption.size,
                        color: TEXT.tertiary,
                        marginTop: 2,
                      }}
                    >
                      {translateBodyPart(ex.body_part)}
                    </div>
                  </div>

                  {/* Chip con la foto HD de la máquina asignada (CG-EQP-XXXX) */}
                  {primary && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: SPACE.xs,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: RADIUS.round,
                          overflow: "hidden",
                          border: `1px solid ${GLASS.border}`,
                          background: SURFACE_ROLE.well,
                        }}
                      >
                        {machineImg ? (
                          <img
                            src={resolveImageSrc(machineImg)}
                            alt={`Foto de ${primary.name}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                            onError={(ev) => {
                              (ev.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <Dumbbell style={{ width: 18, height: 18 }} aria-hidden="true" />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: TYPE.label.size,
                          fontFamily: TYPE.mono.font,
                          color: TEXT.tertiary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 70,
                        }}
                      >
                        {primary.id}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div
              style={{
                padding: SPACE.card,
                textAlign: "center",
                color: TEXT.tertiary,
                fontSize: TYPE.body.size,
              }}
            >
              No se encontró ningún ejercicio con esos filtros.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ExerciseSelectorModal };
export type { CatalogExercise };
