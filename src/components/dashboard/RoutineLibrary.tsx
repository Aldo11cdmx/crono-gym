/**
 * RoutineLibrary.tsx — bottom-sheet library view for routines.
 *
 * A slide-up panel triggered from RoutinesPage. Provides:
 * - Real-time accent-insensitive search (normalize("NFD")).
 * - Three sections: Recientes (non-archived, newest first),
 *   Favoritas (fav non-archived), Archivadas (archived, newest first).
 * - Row actions: favorite toggle, archive/unarchive, delete (with confirmation
 *   and a 6 s immutable undo toast).
 * - States: loading skeleton, empty library, no-search-results, error reload.
 */

import { X, Archive, Clock, LayoutList, Pencil, Search, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { RoutineWithExercises } from "@/hooks/useGymData";
import { useRoutineLastRuns } from "@/hooks/useRoutineLastRuns";
import {
  getArchivedRoutineIds,
  archiveRoutine,
  unarchiveRoutine,
} from "@/lib/routines/routineArchive";
import { supabase } from "@/lib/supabase";
import {
  ACCENT,
  FONT_SANS,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SOLID,
  SPACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import { SHEET_TOP_HIGHLIGHT, HANDLE_TRACK } from "@/design/sheetGradients";

const LABELS = {
  title: "Rutinas",
  searchPlaceholder: "Buscar rutinas…",
  sectionRecent: "Recientes",
  sectionFavorites: "Favoritas",
  sectionArchived: "Archivadas",
  emptyTitle: "No hay rutinas",
  emptyBody: "Crea tu primera rutina para verla aquí.",
  noResults: "No se encontraron rutinas",
  clearSearch: "Limpiar",
  lastRunNever: "Nunca",
  lastRunLabel: "Última vez:",
  deleteConfirmTitle: "¿Eliminar rutina?",
  deleteConfirmBody: "No se podrá deshacer después de 6 s.",
  deleteConfirmAction: "Eliminar",
  deleteConfirmCancel: "Cancelar",
  exerciseOne: "ejercicio",
  exerciseMany: "ejercicios",
  undoDelete: "Deshacer",
  undoExpired: "Eliminada",
  errorRetry: "Reintentar",
  errorBody: "No hemos podido cargar las rutinas.",
  closeAria: "Cerrar",
  archiveAria: "Archivar",
  unarchiveAria: "Restaurar",
  favoriteAria: "Añadir a favoritas",
  unfavoriteAria: "Quitar de favoritas",
  deleteAria: "Eliminar",
  editAria: "Editar",
};

const UNDO_WINDOW_MS = 6000;

const SURFACE_STYLE: CSSProperties = {
  backgroundColor: GLASS.fill,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

const SURFACE_RAISED: CSSProperties = {
  backgroundColor: GLASS.fillRaised,
  borderColor: GLASS.border,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: GLASS.shadow,
};

const OVERLAY_STYLE: CSSProperties = {
  backgroundColor: SCRIM.modal,
  backdropFilter: "blur(8px)",
};

const ROW_GAP = RADIUS.sm;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function formatLastRunRelative(startedAt: string | null, now = Date.now()): string {
  if (!startedAt) return LABELS.lastRunNever;

  const ts = Date.parse(startedAt);
  if (Number.isNaN(ts)) return LABELS.lastRunNever;

  const dayMs = 86400000;
  const diff = now - ts;

  if (diff < dayMs) return "Hoy";
  if (diff < dayMs * 2) return "Ayer";
  if (diff < dayMs * 7) return `Hace ${Math.floor(diff / dayMs)} días`;
  if (diff < dayMs * 30) return `Hace ${Math.floor(diff / (dayMs * 7))} semanas`;
  return `Hace ${Math.floor(diff / (dayMs * 30))} meses`;
}

export interface RoutineLibraryProps {
  userId: string;
  routines: RoutineWithExercises[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  onStart: (routine: RoutineWithExercises) => void;
  onEdit: (routine: RoutineWithExercises) => void;
  onClose: () => void;
}

export function RoutineLibrary({
  userId,
  routines,
  loading,
  error,
  refresh,
  onStart,
  onEdit,
  onClose,
}: RoutineLibraryProps) {
  const [searchText, setSearchText] = useState("");
  const [archivedIds, setArchivedIds] = useState<Set<string>>(
    () => new Set(getArchivedRoutineIds(userId)),
  );
  const [recentlyDeletedId, setRecentlyDeletedId] = useState<string | null>(null);
  const [deletedRoutine, setDeletedRoutine] = useState<RoutineWithExercises | null>(
    null,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] =
    useState<RoutineWithExercises | null>(null);
  const [undoExpired, setUndoExpired] = useState(false);

  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { runs: lastRuns, loading: lastRunsLoading } = useRoutineLastRuns(userId);

  const debouncedSearch = useDebouncedSearch(searchText);

  useEffect(() => {
    setArchivedIds(new Set(getArchivedRoutineIds(userId)));
  }, [userId]);

  const filtered = useMemo(() => {
    const term = normalizeText(debouncedSearch);
    if (!term) return null;
    return routines.filter((r) =>
      r.id === recentlyDeletedId ? false : normalizeText(r.title).includes(term),
    );
  }, [debouncedSearch, routines, recentlyDeletedId]);

  const visibleRoutines = useMemo(
    () => routines.filter((r) => r.id !== recentlyDeletedId),
    [routines, recentlyDeletedId],
  );

  const recent = useMemo(
    () =>
      visibleRoutines
        .filter((r) => !archivedIds.has(r.id))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [visibleRoutines, archivedIds],
  );

  const favorites = useMemo(
    () =>
      visibleRoutines
        .filter((r) => !archivedIds.has(r.id) && r.is_favorite)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [visibleRoutines, archivedIds],
  );

  const archived = useMemo(
    () =>
      visibleRoutines
        .filter((r) => archivedIds.has(r.id))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [visibleRoutines, archivedIds],
  );

  const handleArchive = useCallback(
    (routine: RoutineWithExercises) => {
      const isArchived = archivedIds.has(routine.id);
      if (isArchived) {
        unarchiveRoutine(userId, routine.id);
      } else {
        archiveRoutine(userId, routine.id);
      }
      setArchivedIds((prev) => {
        const next = new Set(prev);
        if (next.has(routine.id)) next.delete(routine.id);
        else next.add(routine.id);
        return next;
      });
    },
    [userId, archivedIds],
  );

  const handleFavorite = useCallback(
    (routine: RoutineWithExercises) => {
      const next = !routine.is_favorite;
      void supabase
        .from("routines")
        .update({ is_favorite: next })
        .eq("id", routine.id)
        .eq("user_id", userId);
      void refresh();
    },
    [userId, refresh],
  );

  const confirmDelete = useCallback((routine: RoutineWithExercises) => {
    setShowDeleteConfirm(routine);
  }, []);

  const executeDelete = useCallback(() => {
    const routine = showDeleteConfirm;
    if (!routine) return;

    setRecentlyDeletedId(routine.id);
    setDeletedRoutine(routine);
    setShowDeleteConfirm(null);
    setUndoExpired(false);

    void deleteRoutineAndRefresh(routine, userId, refresh);

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setUndoExpired(true);
      setRecentlyDeletedId(null);
      setDeletedRoutine(null);
      undoTimerRef.current = null;
    }, UNDO_WINDOW_MS);
  }, [showDeleteConfirm, userId, refresh]);

  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(null);
  }, []);

  const undoDelete = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoExpired(false);
    void restoreRoutine(deletedRoutine!, userId, refresh);
    setRecentlyDeletedId(null);
    setDeletedRoutine(null);
  }, [deletedRoutine, userId, refresh]);

  const handleSearchClear = useCallback(() => {
    setSearchText("");
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchText("");
      onClose();
    }
  };

  const showUndoToast = recentlyDeletedId !== null && deletedRoutine !== null && !undoExpired;

  return (
    <>
      <div
        style={{ ...OVERLAY_STYLE, position: "fixed", inset: 0, zIndex: Z_INDEX.pill }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={LABELS.title}
        style={{
          ...SURFACE_RAISED,
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 420,
          margin: "0 auto",
          borderTopLeftRadius: RADIUS.surface,
          borderTopRightRadius: RADIUS.surface,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          maxHeight: "80vh",
          zIndex: Z_INDEX.pill,
          display: "flex",
          flexDirection: "column",
          animation: `slideUp ${MOTION.slow}ms ${MOTION.standard}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: "relative", padding: `${SPACE.sm}px ${SPACE.lg}px` }}>
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: RADIUS.chip,
              background: HANDLE_TRACK,
              margin: "0 auto",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: SHEET_TOP_HIGHLIGHT,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACE.md}px ${SPACE.lg}px ${SPACE.sm}px`,
          }}
        >
          <h2 style={{ ...TYPE.title2, color: TEXT.primary, margin: 0 }}>{LABELS.title}</h2>
          <button
            aria-label={LABELS.closeAria}
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: RADIUS.round,
              border: "none",
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: `${SPACE.sm}px ${SPACE.lg}px` }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={18}
              style={{ position: "absolute", left: 10, color: TEXT.tertiary, pointerEvents: "none" }}
            />
            <input
              type="search"
              placeholder={LABELS.searchPlaceholder}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                paddingLeft: 36,
                paddingRight: searchText ? 36 : 10,
                height: 40,
                borderRadius: RADIUS.input,
                border: `1px solid ${GLASS.border}`,
                background: GLASS.fill,
                color: TEXT.primary,
                fontSize: TYPE.body.size,
                fontFamily: FONT_SANS,
                outline: "none",
              }}
            />
            {searchText && (
              <button
                aria-label={LABELS.clearSearch}
                onClick={handleSearchClear}
                style={{
                  position: "absolute",
                  right: 8,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: TEXT.tertiary,
                  padding: 4,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingBottom: SPACE.xl }}>
          {error ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: SPACE.md,
                padding: `${SPACE.xl}px ${SPACE.lg}px`,
                color: TEXT.tertiary,
                textAlign: "center",
              }}
            >
              <p style={{ ...TYPE.body, margin: 0 }}>{LABELS.errorBody}</p>
              <button
                onClick={refresh}
                style={{
                  padding: `${SPACE.sm}px ${SPACE.lg}px`,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  background: GLASS.fill,
                  color: TEXT.primary,
                  cursor: "pointer",
                  fontFamily: FONT_SANS,
                  fontSize: TYPE.subhead.size,
                }}
              >
                {LABELS.errorRetry}
              </button>
            </div>
          ) : loading ? (
            <LibrarySkeleton />
          ) : filtered ? (
            filtered.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: SPACE.md,
                  padding: `${SPACE.xl}px ${SPACE.lg}px`,
                  color: TEXT.tertiary,
                  textAlign: "center",
                }}
              >
                <Search size={32} style={{ opacity: 0.3 }} />
                <p style={{ ...TYPE.body, margin: 0 }}>{LABELS.noResults}</p>
                <button
                  onClick={handleSearchClear}
                  style={{
                    padding: `${SPACE.sm}px ${SPACE.lg}px`,
                    borderRadius: RADIUS.control,
                    border: `1px solid ${GLASS.border}`,
                    background: GLASS.fill,
                    color: TEXT.primary,
                    cursor: "pointer",
                    fontFamily: FONT_SANS,
                    fontSize: TYPE.subhead.size,
                  }}
                >
                  {LABELS.clearSearch}
                </button>
              </div>
            ) : (
              <div style={{ padding: `${SPACE.xs}px ${SPACE.lg}px` }}>
                <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}>
                  {filtered.map((routine) => (
                    <LibraryRow
                      key={routine.id}
                      routine={routine}
                      archived={archivedIds.has(routine.id)}
                      lastRun={lastRuns[routine.id] ?? null}
                      lastRunLoading={lastRunsLoading}
                      onStart={onStart}
                      onEdit={onEdit}
                      onArchive={handleArchive}
                      onFavorite={handleFavorite}
                      onDelete={confirmDelete}
                    />
                  ))}
                </div>
              </div>
            )
          ) : (
            <div style={{ padding: `${SPACE.xs}px ${SPACE.lg}px` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
                {recent.length > 0 && (
                  <LibrarySection
                    title={LABELS.sectionRecent}
                    icon={<Clock size={16} />}
                    routines={recent}
                    archivedIds={archivedIds}
                    lastRuns={lastRuns}
                    lastRunLoading={lastRunsLoading}
                    onStart={onStart}
                    onEdit={onEdit}
                    onArchive={handleArchive}
                    onFavorite={handleFavorite}
                    onDelete={confirmDelete}
                  />
                )}

                {favorites.length > 0 && (
                  <LibrarySection
                    title={LABELS.sectionFavorites}
                    icon={<Star size={16} />}
                    routines={favorites}
                    archivedIds={archivedIds}
                    lastRuns={lastRuns}
                    lastRunLoading={lastRunsLoading}
                    onStart={onStart}
                    onEdit={onEdit}
                    onArchive={handleArchive}
                    onFavorite={handleFavorite}
                    onDelete={confirmDelete}
                  />
                )}

                {archived.length > 0 && (
                  <LibrarySection
                    title={LABELS.sectionArchived}
                    icon={<Archive size={16} />}
                    routines={archived}
                    archivedIds={archivedIds}
                    lastRuns={lastRuns}
                    lastRunLoading={lastRunsLoading}
                    onStart={onStart}
                    onEdit={onEdit}
                    onArchive={handleArchive}
                    onFavorite={handleFavorite}
                    onDelete={confirmDelete}
                  />
                )}

                {recent.length === 0 && favorites.length === 0 && archived.length === 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: SPACE.md,
                      padding: `${SPACE.xl}px ${SPACE.lg}px`,
                      color: TEXT.tertiary,
                      textAlign: "center",
                    }}
                  >
                    <LayoutList size={40} style={{ opacity: 0.2 }} />
                    <p style={{ ...TYPE.body, margin: 0 }}>{LABELS.emptyTitle}</p>
                    <p style={{ ...TYPE.caption, margin: 0, maxWidth: 240 }}>
                      {LABELS.emptyBody}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          routine={showDeleteConfirm}
          onConfirm={executeDelete}
          onCancel={cancelDelete}
        />
      )}

      {showUndoToast && deletedRoutine && (
        <UndoToast
          routineTitle={deletedRoutine.title}
          onUndo={undoDelete}
          onDismiss={() => {
            setUndoExpired(true);
            setRecentlyDeletedId(null);
            setDeletedRoutine(null);
          }}
        />
      )}
    </>
  );
}

function LibrarySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm, padding: `${SPACE.xs}px ${SPACE.lg}px` }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
          <div style={{ height: 16, width: "80%", borderRadius: RADIUS.sm, background: GLASS.fill }} />
          <div style={{ height: 12, width: "40%", borderRadius: RADIUS.sm, background: GLASS.fill }} />
        </div>
      ))}
    </div>
  );
}

interface LibrarySectionProps {
  title: string;
  icon: React.ReactNode;
  routines: RoutineWithExercises[];
  archivedIds: Set<string>;
  lastRuns: { [key: string]: string };
  lastRunLoading: boolean;
  onStart: (routine: RoutineWithExercises) => void;
  onEdit: (routine: RoutineWithExercises) => void;
  onArchive: (routine: RoutineWithExercises) => void;
  onFavorite: (routine: RoutineWithExercises, favorite: boolean) => void;
  onDelete: (routine: RoutineWithExercises) => void;
}

function LibrarySection({
  title,
  icon,
  routines,
  archivedIds,
  lastRuns,
  lastRunLoading,
  onStart,
  onEdit,
  onArchive,
  onFavorite,
  onDelete,
}: LibrarySectionProps) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.sm,
          padding: `${SPACE.sm}px ${SPACE.lg}px ${SPACE.xs}px`,
        }}
      >
        {icon}
        <h3 style={{ ...TYPE.caption, color: TEXT.secondary, margin: 0, fontWeight: 600 }}>{title}</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP }}>
        {routines.map((routine) => (
          <LibraryRow
            key={routine.id}
            routine={routine}
            archived={archivedIds.has(routine.id)}
            lastRun={lastRuns[routine.id] ?? null}
            lastRunLoading={lastRunLoading}
            onStart={onStart}
            onEdit={onEdit}
            onArchive={onArchive}
            onFavorite={onFavorite}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

const rowContainerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${SPACE.sm}px ${SPACE.md}px`,
  margin: `0 ${SPACE.sm}px`,
  borderRadius: RADIUS.control,
  cursor: "pointer",
};

const rowSurfaceStyle: CSSProperties = {
  ...SURFACE_STYLE,
  border: `1px solid ${GLASS.border}`,
};

interface LibraryRowProps {
  routine: RoutineWithExercises;
  archived: boolean;
  lastRun: string | null;
  lastRunLoading: boolean;
  onStart: (routine: RoutineWithExercises) => void;
  onEdit: (routine: RoutineWithExercises) => void;
  onArchive: (routine: RoutineWithExercises) => void;
  onFavorite: (routine: RoutineWithExercises, favorite: boolean) => void;
  onDelete: (routine: RoutineWithExercises) => void;
}

function LibraryRow({
  routine,
  archived,
  lastRun,
  lastRunLoading,
  onStart,
  onEdit,
  onArchive,
  onFavorite,
  onDelete,
}: LibraryRowProps) {
  const exerciseCount = routine.exercises?.length ?? 0;
  const lastRunText = lastRunLoading
    ? "..."
    : lastRun
      ? formatLastRunRelative(lastRun)
      : LABELS.lastRunNever;

  return (
    <div style={{ ...rowContainerStyle, ...rowSurfaceStyle }} onClick={() => onStart(routine)}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: TYPE.headline.size,
            fontWeight: TYPE.headline.weight,
            lineHeight: TYPE.headline.lineHeight,
            margin: 0,
            color: TEXT.primary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={routine.title}
        >
          {routine.title}
        </span>
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "center",
            fontSize: TYPE.caption.size,
            color: TEXT.tertiary,
          }}
        >
          <LayoutList size={10} />
          <span>{exerciseCount} {exerciseCount === 1 ? LABELS.exerciseOne : LABELS.exerciseMany}</span>
        </div>
        {lastRun && (
          <div
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              fontSize: TYPE.caption.size,
              color: TEXT.tertiary,
            }}
          >
            <Clock size={10} />
            <span>{LABELS.lastRunLabel} {lastRunText}</span>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACE.xs,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label={LABELS.editAria}
          title="Editar"
          onClick={() => onEdit(routine)}
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.round,
            border: "none",
            background: "transparent",
            color: TEXT.secondary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Pencil size={16} />
        </button>

        <button
          aria-label={routine.is_favorite ? LABELS.unfavoriteAria : LABELS.favoriteAria}
          title={routine.is_favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
          onClick={() => onFavorite(routine, !routine.is_favorite)}
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.round,
            border: "none",
            background: "transparent",
            color: routine.is_favorite ? ACCENT.text : TEXT.tertiary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Star size={16} fill={routine.is_favorite ? ACCENT.text : "none"} />
        </button>

        <button
          aria-label={archived ? LABELS.unarchiveAria : LABELS.archiveAria}
          title={archived ? "Restaurar" : "Archivar"}
          onClick={() => onArchive(routine)}
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.round,
            border: "none",
            background: "transparent",
            color: archived ? ACCENT.text : TEXT.tertiary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Archive size={16} />
        </button>

        <button
          aria-label={LABELS.deleteAria}
          title="Eliminar"
          onClick={() => onDelete(routine)}
          style={{
            width: 32,
            height: 32,
            borderRadius: RADIUS.round,
            border: "none",
            background: "transparent",
            color: TEXT.tertiary,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

interface DeleteConfirmDialogProps {
  routine: RoutineWithExercises;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ routine, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{ ...OVERLAY_STYLE, position: "fixed", inset: 0, zIndex: Z_INDEX.modal }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={LABELS.deleteConfirmTitle}
        style={{
          ...SURFACE_RAISED,
          position: "fixed",
          bottom: 90,
          left: 20,
          right: 20,
          maxWidth: 400,
          margin: "0 auto",
          borderRadius: RADIUS.control,
          padding: SPACE.md,
          zIndex: Z_INDEX.modal,
          animation: `slideUp ${MOTION.slow}ms ${MOTION.standard}`,
        }}
      >
        <h3 style={{ ...TYPE.title2, color: TEXT.primary, margin: 0, marginBottom: SPACE.sm }}>
          {LABELS.deleteConfirmTitle}
        </h3>
        <p style={{ ...TYPE.body, color: TEXT.secondary, margin: 0, marginBottom: SPACE.md }}>
          {routine.title}
        </p>
        <p style={{ ...TYPE.caption, color: TEXT.tertiary, margin: 0, marginBottom: SPACE.md }}>
          {LABELS.deleteConfirmBody}
        </p>
        <div style={{ display: "flex", gap: SPACE.sm, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
              color: TEXT.primary,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              fontSize: TYPE.subhead.size,
            }}
          >
            {LABELS.deleteConfirmCancel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              background: SOLID.popover,
              color: TEXT.primary,
              cursor: "pointer",
              fontFamily: FONT_SANS,
              fontSize: TYPE.subhead.size,
            }}
          >
            {LABELS.deleteConfirmAction}
          </button>
        </div>
      </div>
    </>
  );
}

interface UndoToastProps {
  routineTitle: string;
  onUndo: () => void;
  onDismiss: () => void;
}

function UndoToast({ routineTitle, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      style={{
        ...SURFACE_RAISED,
        position: "fixed",
        right: SPACE.gutter,
        bottom: `calc(${SPACE.xl}px + 72px)`,
        borderRadius: RADIUS.control,
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        display: "inline-flex",
        alignItems: "center",
        gap: SPACE.sm,
        zIndex: Z_INDEX.toast,
        animation: `fadeIn ${MOTION.slow}ms ${MOTION.standard}`,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <Trash2 size={14} style={{ color: TEXT.tertiary, flexShrink: 0 }} />
      <span
        style={{ fontSize: TYPE.caption.size, color: TEXT.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={routineTitle}
      >
        "{routineTitle}" eliminada
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          fontFamily: FONT_SANS,
          fontSize: TYPE.subhead.size,
          fontWeight: TYPE.subhead.weight,
          color: ACCENT.text,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {LABELS.undoDelete}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={LABELS.closeAria}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          borderRadius: RADIUS.chip,
          border: "none",
          background: "transparent",
          color: TEXT.tertiary,
          cursor: "pointer",
        }}
      >
        <X size={10} />
      </button>
    </div>
  );
}

function useDebouncedSearch(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setDebounced(value);
      return;
    }
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);

  return debounced;
}

async function deleteRoutineAndRefresh(
  routine: RoutineWithExercises,
  userId: string,
  refresh: () => Promise<void>,
): Promise<void> {
  await supabase.from("routine_exercises").delete().eq("routine_id", routine.id);
  await supabase.from("routines").delete().eq("id", routine.id).eq("user_id", userId);
  void refresh();
}

async function restoreRoutine(
  routine: RoutineWithExercises,
  userId: string,
  refresh: () => Promise<void>,
): Promise<void> {
  try {
    const resolvedSource = routine.source === null ? "user" : routine.source;
    const { data, error: err } = await supabase
      .from("routines")
      .insert({
        id: routine.id,
        user_id: userId,
        title: routine.title,
        description: routine.description ?? null,
        source: resolvedSource,
      })
      .select("id")
      .single();
    if (err || !data) return;

    const rows = routine.exercises.map((pe, index) => ({
      routine_id: data.id,
      exercise_id: pe.exercise.id,
      target_sets: pe.target_sets,
      rest_seconds: pe.rest_seconds,
      order_index: index,
      day_index: pe.dayIndex ?? 0,
      day_label: pe.dayLabel ?? "",
      target_reps_min: null,
      target_reps_max: null,
    }));
    if (rows.length > 0) {
      await supabase.from("routine_exercises").insert(rows);
    }
    void refresh();
  } catch {
    void refresh();
  }
}
