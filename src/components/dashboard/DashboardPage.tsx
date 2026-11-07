/**
 * DashboardPage.tsx — Cronos Gym home dashboard (Command Center / Today).
 *
 * Instrumento Editorial Cronos: negro profundo, un solo acento crimson,
 * jerarquía clara, números tabulares y sin tarjetas anidadas innecesarias.
 *
 * Layout:
 * - Escritorio: fila superior Hero (8 cols) + lateral PR y Cronos IA (4 cols);
 *   fila inferior Semana (8 cols) + Historial (4 cols).
 * - Móvil: una sola columna en orden de lectura: Header, Hero, Esta semana,
 *   Récords, Historial, Cronos IA, Navegación inferior.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw, AlertTriangle } from "lucide-react";

import { useDashboardHome } from "@/lib/dashboard/dashboardHomeModel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { resolveTrainingIntent } from "@/lib/workout/trainingIntent";
import { PROFILE_PATH, PROGRESS_PATH, TRAIN_PATH } from "@/components/shell/navItems";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { supabase } from "@/lib/supabase";
import { CoachBanner } from "@/components/coach/portal/CoachBanner";
import { WeeklyProgressSection } from "@/components/dashboard/sections/WeeklyProgressSection";
import { TipSection } from "@/components/dashboard/sections/TipSection";
import { TrainingHeroSection } from "@/components/dashboard/sections/TrainingHeroSection";
import { PRSection } from "@/components/dashboard/sections/PRSection";
import { HistorySection } from "@/components/dashboard/sections/HistorySection";
import { RecoverableDraftSection } from "@/components/dashboard/sections/RecoverableDraftSection";
import { RequestRoutineModal } from "@/components/coach/portal/RequestRoutineModal";
import { UserAvatar } from "@/components/common/UserAvatar";
import {
  ACCENT,
  GLASS,
  RADIUS,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";

/**
 * Canvas contextual de Today (Command Center). No modifica SURFACE.base global.
 * Se apoya en negro profundo + glass existente para integrarse con AppShell/body.
 */
const TODAY_CANVAS = "#000000";

interface Announcement {
  id: string;
  title: string;
  message: string;
  kind: "promo" | "notice" | "event";
  starts_at: string;
  expires_at: string;
}

const KIND_LABELS: Record<Announcement["kind"], string> = {
  promo: "Promoci&oacute;n",
  notice: "Aviso",
  event: "Evento",
};

/** Videogame-loading-screen style tips for the empty feed state. */
interface Tip {
  id: string;
  text: string;
  icon: "lightbulb" | "zap";
  category: "entrenamiento" | "rir-rpe" | "nutricion" | "descanso";
}

const TIP_CATALOG: Tip[] = [
  {
    id: "tip-1",
    text: "Deja 1-2 reps en la reserva (RIR 1-2) para la mayoria de las series.",
    icon: "zap",
    category: "rir-rpe",
  },
  {
    id: "tip-2",
    text: "Descansa 2-3 min entre series de fuerza para recuperar ATP.",
    icon: "zap",
    category: "descanso",
  },
  {
    id: "tip-3",
    text: "Consume 1.6-2.2g de proteinas por kg de peso corporal.",
    icon: "lightbulb",
    category: "nutricion",
  },
  {
    id: "tip-4",
    text: "Duerme 7-9 horas para maximizar la recuperacion.",
    icon: "lightbulb",
    category: "descanso",
  },
  {
    id: "tip-5",
    text: "No entrenes el mismo grupo muscular dos dias seguidos.",
    icon: "zap",
    category: "entrenamiento",
  },
  {
    id: "tip-6",
    text: "Lleva un registro de tus series y pesos para progresar.",
    icon: "lightbulb",
    category: "entrenamiento",
  },
  {
    id: "tip-7",
    text: "El RPE mide el esfuerzo percibido del 1 al 10.",
    icon: "zap",
    category: "rir-rpe",
  },
  {
    id: "tip-8",
    text: "Hidratate antes, durante y despues del entrenamiento.",
    icon: "lightbulb",
    category: "nutricion",
  },
  {
    id: "tip-9",
    text: "Calienta 5-10 min antes de cargas pesadas.",
    icon: "zap",
    category: "entrenamiento",
  },
  {
    id: "tip-10",
    text: "La sobrecarga progresiva es la clave del crecimiento.",
    icon: "lightbulb",
    category: "entrenamiento",
  },
  {
    id: "tip-11",
    text: "Descansa 48h entre sesiones del mismo musculo.",
    icon: "lightbulb",
    category: "descanso",
  },
  {
    id: "tip-12",
    text: "Un RPE de 8-9 es ideal para hipertrofia.",
    icon: "zap",
    category: "rir-rpe",
  },
];

interface DashboardPageProps {
  userId: string;
}

type SessionState = "idle" | "scheduled" | "in-progress" | "completed";

/** Resolves the hero routine title: falls back to day label when raw title is invalid. */
function resolveRoutineTitle(
  routine: { title: string | null | undefined } | null,
  dayLabel: string | null | undefined,
): string {
  const raw = routine?.title?.trim();
  if (!raw || raw.toLowerCase() === "xd" || raw.length <= 1) {
    return dayLabel ?? "Entrenamiento de Hoy";
  }
  return raw;
}

export function DashboardPage({ userId }: DashboardPageProps) {
  const navigate = useNavigate();
  const data = useDashboardHome(userId);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("coaches")
          .select("id")
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (data) setCoachId(data.id);
      } catch {
        // Si no se puede leer el coach, el banner simplemente no se muestra.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAnnouncementsLoading(true);
    (async () => {
      try {
        const { data: rows, error } = await (supabase as any)
          .from("announcements")
          .select("id, title, message, kind, starts_at, expires_at")
          .order("starts_at", { ascending: false });
        if (cancelled) return;
        if (error) {
          setAnnouncementsError(error.message);
          setAnnouncements([]);
        } else {
          setAnnouncements((rows ?? []) as Announcement[]);
          setAnnouncementsError(null);
        }
      } catch {
        if (cancelled) return;
        setAnnouncementsError("No se pudieron cargar los anuncios.");
        setAnnouncements([]);
      } finally {
        if (!cancelled) setAnnouncementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sessionState = useMemo<SessionState>(() => {
    if (data.isSessionActive) return "in-progress";
    if (data.completedToday) return "completed";
    return data.dailyFocus.isRestDay ? "scheduled" : "idle";
  }, [data.isSessionActive, data.completedToday, data.dailyFocus.isRestDay]);

  const routine = data.heroRoutineSummary;
  const suggested = data.scheduledRoutine ?? data.suggestedRoutine;
  const hasRoutine = routine !== null;

  const ctaLabel = useMemo(() => {
    if (data.rehydrating) return "Comprobando sesión...";
    if (data.recoverableDraft) {
      return `Recuperar entrenamiento: ${data.recoverableDraft.routineTitle ?? "Entrenamiento"}`;
    }
    if (sessionState === "completed") return "Ver historial";
    if (sessionState === "in-progress") {
      const activeTitle = data.activeSession?.title?.trim();
      return activeTitle ? `Continuar: ${activeTitle}` : "Continuar entrenamiento";
    }
    return "Comenzar entrenamiento";
  }, [
    sessionState,
    data.rehydrating,
    data.recoverableDraft,
    data.activeSession?.title,
  ]);

  const weeklyCompleted = data.weeklyProgress.completed;
  const weeklyGoal = data.weeklyProgress.goal;

  const handlePrimary = useCallback(() => {
    const target = suggested ? { id: suggested.id, title: suggested.title } : null;
    const intent = resolveTrainingIntent({
      rehydrating: data.rehydrating,
      session: data.activeSession
        ? { routineId: data.activeSession.routineId, title: data.activeSession.title }
        : null,
      recoverableDraft: data.recoverableDraft
        ? { routineId: data.recoverableDraft.routineId, routineTitle: data.recoverableDraft.routineTitle }
        : null,
      targetRoutineId: target?.id ?? null,
      targetRoutineTitle: target?.title ?? null,
      allowFreeStart: false,
    });

    if (intent.action === "wait") return;
    if (sessionState === "completed") {
      navigate(PROGRESS_PATH);
      return;
    }
    if (intent.action === "restore") {
      data.restoreDraft();
      navigate(TRAIN_PATH);
      return;
    }
    if (intent.action === "continue") {
      navigate(TRAIN_PATH);
      return;
    }
    if (intent.action !== "start" || !target) return;
    const result = data.startSession({ routine: target });
    if (result?.ok) navigate(TRAIN_PATH);
  }, [
    sessionState,
    suggested,
    data.startSession,
    navigate,
    data.rehydrating,
    data.recoverableDraft,
    data.restoreDraft,
    data.activeSession,
  ]);

  const nextTip = useCallback(() => {
    setTipIndex((i) => (i + 1) % TIP_CATALOG.length);
  }, []);

  const firstError = useMemo(() => {
    for (const value of Object.values(data.errors)) {
      if (value !== null) return value;
    }
    return null;
  }, [data.errors]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );

  const showConflictNotice =
    !!data.activeSession &&
    !!suggested &&
    data.activeSession.routineId !== suggested.id &&
    !data.recoverableDraft;

  // Cualquier origen cargando: esqueletos, sin CTA ni datos a medio renderizar.
  if (data.loading) {
    return (
      <div className="w-full flex flex-col gap-4 md:gap-6 p-4 md:p-6">
        <GlassCard raised>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.sm,
            }}
          >
            <div
              style={{
                height: "20px",
                width: "100%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
            <div
              style={{
                height: "20px",
                width: "60%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
            <div
              style={{
                height: "20px",
                width: "40%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div
      data-testid="today-command-center-root"
      className="w-full min-w-0 flex flex-col gap-5 md:gap-6"
      style={{
        backgroundColor: TODAY_CANVAS,
        backgroundImage: `radial-gradient(120% 70% at 50% -10%, ${ACCENT.subtle} 0%, transparent 58%)`,
        paddingInline: 20,
        paddingTop: SPACE.md,
        paddingBottom: SPACE.lg,
      }}
    >
      <header
        className="flex items-center justify-between gap-3"
        aria-label="Encabezado de Today"
      >
        <div className="min-w-0">
          <p className="hidden sm:inline" style={{ ...TYPE.label, color: ACCENT.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Cronos
          </p>
          <p style={{ ...TYPE.caption, color: TEXT.tertiary, margin: 0, textTransform: "capitalize" }}>
            {todayLabel}
          </p>
        </div>
        <Link
          to={PROFILE_PATH}
          aria-label="Abrir perfil"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: SPACE.sm,
            textDecoration: "none",
            color: TEXT.primary,
            padding: `${SPACE.xs} ${SPACE.sm}`,
            borderRadius: RADIUS.pill,
            border: `1px solid ${GLASS.border}`,
            background: GLASS.fill,
          }}
        >
          <span className="hidden sm:inline" style={{ ...TYPE.caption, color: TEXT.secondary, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.displayName ?? "Perfil"}
          </span>
          <UserAvatar name={data.displayName ?? userId} size={32} />
        </Link>
      </header>

      {firstError !== null && (
        <GlassCard raised style={{ border: `1px solid ${STATUS.error.border}` }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE.md,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACE.sm,
                color: STATUS.error.text,
                fontSize: TYPE.body.size,
              }}
            >
              <span aria-hidden="true" style={{ display: "inline-flex" }}>
                <AlertTriangle size={20} />
              </span>
              <span>{firstError}</span>
            </div>
            <GlassButton
              variant="primary"
              icon={<RefreshCw size={16} />}
              onClick={() => void data.refreshAll()}
            >
              Reintentar
            </GlassButton>
          </div>
        </GlassCard>
      )}

      <div
        data-testid="today-command-center"
        className="grid grid-cols-1 gap-5 md:gap-6 xl:grid-cols-12 items-start"
      >
        {/* Columna principal superior: Hero + acciones condicionales del contexto.
             En móvil va primero (order-1); en escritorio se coloca con xl:col-span-8 xl:row-start-1. */}
        <div
          className="flex flex-col gap-5 md:gap-6 min-w-0 xl:col-span-8 xl:row-start-1 order-1 sm:order-auto"
        >
          <TrainingHeroSection
            greeting={data.greeting}
            hasRoutine={hasRoutine}
            routineTitle={resolveRoutineTitle(routine, data.dailyFocus.dayLabel)}
            exerciseCount={hasRoutine ? routine!.exerciseCount : 0}
            estimatedDurationMin={hasRoutine ? routine!.estimatedDurationMin : 0}
            muscleCounts={data.muscleCounts}
            ctaLabel={ctaLabel}
            rehydrating={data.rehydrating}
            onPrimary={handlePrimary}
            focusLabel={hasRoutine ? data.dailyFocus.dayLabel : null}
            isCompleted={sessionState === "completed"}
            isRecoverable={!!data.recoverableDraft}
            compact={isMobile}
          />

          {coachId && (
            <>
              <CoachBanner coachId={coachId} onRequestRoutine={() => setRequestOpen(true)} />
              <RequestRoutineModal
                coachId={coachId}
                open={requestOpen}
                onClose={() => setRequestOpen(false)}
                onSuccess={() => setRequestOpen(false)}
              />
            </>
          )}

          {showConflictNotice && data.activeSession && (
            <GlassCard raised style={{ padding: SPACE.card, border: `1px solid ${GLASS.borderStrong}` }}>
              <p style={{ ...TYPE.body, color: TEXT.secondary, margin: 0 }}>
                Entrenamiento activo: <strong style={{ color: TEXT.primary }}>{data.activeSession.title}</strong>.
                La rutina programada no se ha iniciado para proteger la sesión actual.
              </p>
            </GlassCard>
          )}

          {data.recoverableDraft && (
            <RecoverableDraftSection
              routineTitle={data.recoverableDraft.routineTitle}
              onContinue={() => {
                data.restoreDraft();
                navigate(TRAIN_PATH);
              }}
              onDiscard={data.discardDraft}
            />
          )}
        </div>

        {/* Progreso semanal: en móvil va segundo (order-2); en escritorio xl:col-span-8 xl:row-start-2. */}
        <WeeklyProgressSection
          weeklyCompleted={weeklyCompleted}
          weeklyGoal={weeklyGoal}
          weeklyPlan={data.weeklyPlan}
          streakStats={data.streakStats}
          className="xl:col-span-8 xl:row-start-2 order-2 sm:order-auto"
        />

        {/* Historial reciente: en móvil va tercero (order-3), máximo 3 filas;
             en escritorio xl:col-span-4 xl:row-start-2. */}
        <HistorySection
          sessions={data.recentSessions}
          maxVisible={isMobile ? 3 : 4}
          className="xl:col-span-4 xl:row-start-2 order-3 sm:order-auto"
        />

        {/* Columna lateral superior: Cronos IA y Récords.
             En móvil: Cronos IA primero (order-1 dentro), Récords después (order-2 dentro).
             En escritorio: Récords primero, Cronos IA después; xl:col-span-4 xl:row-start-1. */}
        <div className="flex flex-col gap-5 md:gap-6 min-w-0 xl:col-span-4 xl:row-start-1 order-4 sm:order-auto">
          {/* Cronos IA: primera en móvil, segunda en escritorio. */}
          <div className="flex flex-col gap-4 order-1 sm:order-2">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p style={{ ...TYPE.label, color: ACCENT.text, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Cronos IA
                </p>
                <p style={{ ...TYPE.title2, color: TEXT.primary, margin: `${SPACE.xs} 0 0`, letterSpacing: "-0.02em" }}>
                  Tips y anuncios
                </p>
              </div>
            </div>

            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                style={{
                  padding: `${SPACE.sm} 0`,
                  borderTop: `1px solid ${GLASS.border}`,
                }}
              >
                <span
                  style={{
                    ...TYPE.caption,
                    color: ACCENT.text,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {KIND_LABELS[announcement.kind]}
                </span>
                <h3
                  style={{
                    ...TYPE.subhead,
                    color: TEXT.primary,
                    margin: `${SPACE.xs} 0 0`,
                  }}
                >
                  {announcement.title}
                </h3>
                <p
                  style={{
                    ...TYPE.body,
                    color: TEXT.secondary,
                    margin: `${SPACE.xs} 0 0`,
                  }}
                >
                  {announcement.message}
                </p>
              </div>
            ))}

            {announcements.length === 0 &&
              !announcementsLoading &&
              !announcementsError && (
                <TipSection tip={TIP_CATALOG[tipIndex]} onNext={nextTip} embedded />
              )}
            {announcementsLoading ? (
              <p style={{ ...TYPE.body, color: TEXT.tertiary, margin: 0 }}>Cargando anuncios...</p>
            ) : null}
            {announcementsError ? (
              <p style={{ ...TYPE.caption, color: STATUS.error.text, margin: 0 }}>{announcementsError}</p>
            ) : null}
          </div>

          {/* Récords personales: segunda en móvil, primera en escritorio. */}
          <PRSection recentPRs={data.recentPRs} compact={isMobile} className="order-2 sm:order-1" />
        </div>
      </div>
    </div>
  );
}
