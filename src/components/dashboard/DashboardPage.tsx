/**
 * DashboardPage.tsx — Cronos Gym home dashboard (clean slate).
 *
 * Glassmorphic Pro layout, una sola jerarquía visual:
 *
 * 1. Hero: saludo, metadatos de la rutina sugerida y un ÚNICO botón primario
 *    prominente ("Comenzar entrenamiento"). Sin CTA duplicados, sin FAB flotante.
 * 2. Consistencia semanal: barra de dias (L M X J V S D) y racha
 *    ("2/3 completados") en una sola GlassCard horizontal compacta.
 * 3. Feed de inteligencia: FatigueAlertCard y los anuncios activos de la tabla
 *    `announcements`, en lugar del bloque obsoleto de "Records recientes".
 *
 * Todos los textos staticos estan escritos con entidades HTML o sin tilde,
 * asi el UTF-8 no puede leerse mal como mojibake (A©, A·, A3).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, RefreshCw, AlertTriangle, Lightbulb, Zap, RotateCcw } from "lucide-react";

import { useDashboardHome } from "@/lib/dashboard/dashboardHomeModel";
import { WEEKDAY_SHORT_ES } from "@/lib/dashboard/heroCardModel";
import { PROGRESS_PATH, TRAIN_PATH } from "@/components/shell/navItems";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { FatigueAlertCard } from "@/components/FatigueAlertCard";
import { supabase } from "@/lib/supabase";
import {
  ACCENT,
  GLASS,
  RADIUS,
  SPACE,
  STATUS,
  SURFACE_ROLE,
  TEXT,
  TYPE,
} from "@/design/tokens";

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

/** Resolves the hero routine title: falls back to day label when raw title is "xd" or empty. */
function resolveRoutineTitle(
  routine: { title: string | null | undefined } | null,
  dayLabel: string | null | undefined,
): string {
  const raw = routine?.title?.trim();
  if (!raw || raw.toLowerCase() === "xd") {
    return dayLabel ?? "Rutina del Dia";
  }
  return raw;
}

export function DashboardPage({ userId }: DashboardPageProps) {
  const navigate = useNavigate();
  const data = useDashboardHome(userId);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

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
  const suggested = data.suggestedRoutine;
  const hasRoutine = routine !== null;

  const ctaLabel = useMemo(() => {
    if (sessionState === "completed") return "Ver historial";
    if (sessionState === "in-progress") return "Continuar entrenamiento";
    return "Comenzar entrenamiento";
  }, [sessionState]);

  const weeklyCompleted = data.weeklyProgress.completed;
  const weeklyGoal = data.weeklyProgress.goal;

  const handlePrimary = useCallback(() => {
    if (sessionState === "completed") {
      navigate(PROGRESS_PATH);
      return;
    }
    if (suggested) {
      data.startSession({ id: suggested.id, title: suggested.title });
    }
    navigate(TRAIN_PATH);
  }, [sessionState, suggested, data.startSession, navigate]);

  const nextTip = useCallback(() => {
    setTipIndex((i) => (i + 1) % TIP_CATALOG.length);
  }, []);

  const firstError = useMemo(() => {
    for (const value of Object.values(data.errors)) {
      if (value !== null) return value;
    }
    return null;
  }, [data.errors]);

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
      className="w-full flex flex-col gap-4 md:gap-6 p-4 md:p-6"
      style={{
        background: `radial-gradient(circle at top, ${ACCENT.muted} 0%, transparent 60%), ${SURFACE_ROLE.canvas}`,
      }}
    >
      {/* Error recuperable */}
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

      {/* Hero — saludo, rutina objetivo, unico CTA primario, monito a la derecha */}
      <GlassCard
        raised
        style={{
          padding: SPACE.card,
          border: `1px solid ${data.isSessionActive ? ACCENT.border : GLASS.border}`,
          boxShadow: data.isSessionActive
            ? `0 0 24px ${ACCENT.glow}`
            : GLASS.shadow,
        }}
      >
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0">
            <p
              style={{
                ...TYPE.callout,
                color: TEXT.secondary,
                margin: 0,
              }}
            >
              {data.greeting}
            </p>
            {hasRoutine ? (
              <>
                <h1
                  style={{
                    ...TYPE.hero,
                    color: TEXT.primary,
                    margin: 0,
                    wordBreak: "break-word",
                  }}
                >
                  {resolveRoutineTitle(routine, data.dailyFocus.dayLabel)}
                </h1>
                <p
                  style={{
                    ...TYPE.subhead,
                    color: TEXT.secondary,
                    margin: 0,
                  }}
                >
                  {resolveRoutineTitle(routine, data.dailyFocus.dayLabel)} &middot; {routine.exerciseCount} ej &middot; {routine.estimatedDurationMin} min
                </p>
              </>
            ) : (
              <>
                <h1
                  style={{
                    ...TYPE.hero,
                    color: TEXT.primary,
                    margin: 0,
                  }}
                >
                  Rutina del d&iacute;a
                </h1>
                <p
                  style={{
                    ...TYPE.subhead,
                    color: TEXT.secondary,
                    margin: 0,
                  }}
                >
                  Crea tu primera rutina para empezar
                </p>
              </>
            )}
            <div style={{ marginTop: SPACE.lg }}>
              <GlassButton
                variant="primary"
                block
                icon={<Play size={16} />}
                onClick={handlePrimary}
                style={{ boxShadow: ACCENT.ring }}
              >
                {ctaLabel}
              </GlassButton>
            </div>
          </div>
          <div
            className="overflow-hidden rounded-2xl bg-white/5 border border-white/10"
            style={{ width: 120, height: 192 }}
          >
            <MuscleReadonlyMap
              counts={hasRoutine && data.muscleCounts ? data.muscleCounts : new Map()}
              idleHint={
                "Elige una rutina para ver los m&uacute;sculos que trabajar&aacute;"
              }
              label="Torso anat&oacute;mico"
              aspectRatio={120 / 192}
            />
          </div>
        </div>
      </GlassCard>

      {/* Consistencia semanal — barra de dias y racha en una sola tarjeta horizontal */}
      <GlassCard raised style={{ padding: SPACE.card }}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              style={{
                ...TYPE.subhead,
                color: TEXT.secondary,
              }}
            >
              Esta semana
            </span>
            <span
              style={{
                ...TYPE.mono,
                color: TEXT.primary,
              }}
            >
              {weeklyCompleted}/{weeklyGoal} completados
            </span>
          </div>
          <div className="flex gap-1">
            {WEEKDAY_SHORT_ES.map((short, index) => {
              const day = data.weeklyPlan[index];
              const isToday = day?.isToday ?? false;
              const trained = day?.trained ?? false;
              return (
                <span
                  key={short}
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: RADIUS.round,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: TYPE.caption.size,
                    fontWeight: isToday ? 600 : TYPE.caption.weight,
                    color: isToday
                      ? TEXT.onAccent
                      : trained
                        ? TEXT.primary
                        : TEXT.tertiary,
                    background: isToday
                      ? ACCENT.base
                      : trained
                        ? GLASS.fillRaised
                        : GLASS.fill,
                    border: `1px solid ${isToday ? ACCENT.border : GLASS.border}`,
                  }}
                >
                  {short}
                </span>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Feed de inteligencia y anuncios */}
      <GlassCard raised style={{ padding: SPACE.card }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.md,
          }}
        >
          <FatigueAlertCard status="normal" muscle="pecho" />
          {announcements.map((announcement) => (
            <GlassCard key={announcement.id} raised flush>
              <span
                style={{
                  ...TYPE.caption,
                  color: ACCENT.text,
                  textTransform: "uppercase",
                }}
              >
                {KIND_LABELS[announcement.kind]}
              </span>
              <h3
                style={{
                  ...TYPE.subhead,
                  color: TEXT.primary,
                  margin: `0 0 ${SPACE.xs} 0`,
                }}
              >
                {announcement.title}
              </h3>
              <p
                style={{
                  ...TYPE.body,
                  color: TEXT.secondary,
                  margin: 0,
                }}
              >
                {announcement.message}
              </p>
            </GlassCard>
          ))}
          {announcements.length === 0 &&
            !announcementsLoading &&
            !announcementsError && (
              <GlassCard raised style={{ padding: SPACE.card }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: SPACE.md,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: SPACE.sm,
                    }}
                  >
                    {TIP_CATALOG[tipIndex].icon === "lightbulb" ? (
                      <Lightbulb size={20} style={{ color: ACCENT.text }} />
                    ) : (
                      <Zap size={20} style={{ color: ACCENT.text }} />
                    )}
                    <span
                      style={{
                        ...TYPE.body,
                        color: TEXT.primary,
                      }}
                    >
                      {TIP_CATALOG[tipIndex].text}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <GlassButton
                      variant="secondary"
                      icon={<RotateCcw size={16} />}
                      onClick={nextTip}
                    >
                      Siguiente tip
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            )}
        </div>
      </GlassCard>
    </div>
  );
}
