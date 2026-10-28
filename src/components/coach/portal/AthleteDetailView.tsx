/**
 * AthleteDetailView.tsx — ficha completa del atleta para el coach en móvil.
 *
 * Muestra el perfil del atleta (objetivo, días a la semana, equipo, fase,
 * notas privadas) y el chat en vivo de la solicitud seleccionada.
 *
 * Reemplaza la columna derecha de dos paneles en móvil: cuando el coach abre
 * una conversación desde la cola, esta vista ocupa toda la pantalla y un
 * botón "Volver" regresa a la cola.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Dumbbell, MessageSquare, Sparkles, User } from "lucide-react";

import { ACCENT, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { HumanCoachChat } from "./HumanCoachChat";
import { supabase } from "@lib/supabase";
import { hapticLight } from "@/lib/haptics";

export interface AthleteDetailViewProps {
  /** La solicitud activa (lleva el id para el chat). */
  requestId: string | null;
  /** El atleta del que se lee la ficha. */
  athleteId: string;
  /** El coach autenticado (id de `auth.uid()` para enviar mensajes al chat). */
  coachUserId: string;
  /** Regresa a la pantalla anterior (cola de solicitudes). */
  onBack: () => void;
}

function parseAthleteNotes(notes: string | null): {
  goal: string;
  days: string;
  equipment: string;
} {
  const goalMatch = notes?.match(/Objetivo:\s*([^\n]+)/);
  const daysMatch = notes?.match(/Días a la semana:\s*([^\n]+)/);
  const equipmentMatch = notes?.match(/Equipo:\s*([^\n]+)/);

  return {
    goal: goalMatch?.[1]?.trim() ?? T.athleteDetailUnknown,
    days: daysMatch?.[1]?.trim() ?? T.athleteDetailUnknown,
    equipment: equipmentMatch?.[1]?.trim() ?? T.athleteDetailUnknown,
  };
}

export function AthleteDetailView({
  requestId,
  athleteId,
  coachUserId,
  onBack,
}: AthleteDetailViewProps) {
  const [profile, setProfile] = useState<{
    display_name: string | null;
    goal: string;
    weight_kg: number | null;
    height_cm: number | null;
  } | null>(null);
  const [requestNotes, setRequestNotes] = useState<string | null>(null);
  const [phase, setPhase] = useState<"deload" | "maintenance" | "overload" | null>(null);
  const [activeTab, setActiveTab] = useState<"ficha" | "chat" | "rutina">("ficha");
  const [coachNotes, setCoachNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullStartY, setPullStartY] = useState<number | null>(null);

  const PULL_THRESHOLD = 80;
  const SWIPE_THRESHOLD = 50;

  const contentRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Perfil del atleta (nombre y objetivo guardado en onboarding)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, goal, weight_kg, height_cm")
        .eq("user_id", athleteId)
        .maybeSingle();

      if (!mounted.current) return;
      if (profileError) throw profileError;

      setProfile({
        display_name: typeof profileData?.display_name === "string"
          ? profileData.display_name
          : null,
        goal: typeof profileData?.goal === "string" && profileData.goal.trim() !== ""
          ? profileData.goal
          : T.athleteDetailUnknown,
        weight_kg: typeof profileData?.weight_kg === "number" ? profileData.weight_kg : null,
        height_cm: typeof profileData?.height_cm === "number" ? profileData.height_cm : null,
      });

      // 2. Notas de la solicitud más reciente de este atleta (tiene objetivo, días, equipo)
      const { data: requestData, error: requestError } = await supabase
        .from("coach_session_requests")
        .select("athlete_notes")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted.current) return;
      if (requestError) throw requestError;

      setRequestNotes(requestData?.athlete_notes ?? null);

      // 3. Fase actual del atleta
      const { data: phaseData, error: phaseError } = await supabase
        .from("athlete_phases")
        .select("phase")
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (!mounted.current) return;
      if (phaseError) throw phaseError;

      setPhase(phaseData?.phase ?? null);

      // 4. Notas privadas del coach para este atleta
      const { data: notesData, error: notesError } = await supabase
        .from("coach_notes")
        .select("content")
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (!mounted.current) return;
      if (notesError) throw notesError;

      setCoachNotes(notesData?.content ?? null);
    } catch (err) {
      if (!mounted.current) return;
      setError(
        err instanceof Error ? err.message : T.crmLoadError,
      );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [athleteId]);

  const handlePullTouchStart = useCallback((e: React.TouchEvent) => {
    const el = contentRef.current;
    if (el?.scrollTop ?? 0 > 0) return;
    setPullStartY(e.touches[0].clientY);
  }, []);

  const handlePullTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY === null) return;
    const el = contentRef.current;
    if (el?.scrollTop ?? 0 > 0) return;
    const distance = e.touches[0].clientY - pullStartY;
    if (distance > 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, PULL_THRESHOLD + 60));
    }
  }, [pullStartY]);

  const handlePullTouchEnd = useCallback(async () => {
    setPullStartY(null);
    if (pullDistance >= PULL_THRESHOLD && mounted.current) {
      void load();
    }
    setPullDistance(0);
  }, [pullDistance, load]);

  const handleTabTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTabTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      const tabs = ["ficha", "chat", "rutina"] as const;
      const idx = tabs.indexOf(activeTab);
      const nextIdx = diff > 0 ? Math.min(idx + 1, tabs.length - 1) : Math.max(idx - 1, 0);
      const nextTab = tabs[nextIdx];
      if (nextTab !== activeTab) {
        hapticLight();
        setActiveTab(nextTab);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsed = requestNotes ? parseAthleteNotes(requestNotes) : null;

  const phaseLabel = (() => {
    if (!phase) return T.athleteDetailUnknown;
    if (phase === "deload") return T.phaseDeload;
    if (phase === "maintenance") return T.phaseMaintenance;
    if (phase === "overload") return T.phaseOverload;
    return phase;
  })();

  if (loading) {
    return (
      <GlassCard raised style={{ padding: SPACE.card }}>
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {T.loading}
        </p>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard raised style={{ padding: SPACE.card }}>
        <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: STATUS.error.text }}>
          {error}
        </p>
      </GlassCard>
    );
  }

    return (
      <>
        <div
          ref={contentRef}
      onTouchStart={handlePullTouchStart}
      onTouchMove={handlePullTouchMove}
      onTouchEnd={handlePullTouchEnd}
      style={{
        touchAction: pullDistance > 0 ? "none" : "auto",
      }}
    >
      <section className="flex min-w-0 flex-col gap-4">
        {/* Header con nombre y botón volver */}
        <GlassCard raised style={{ padding: SPACE.card }}>
          <div className="flex items-center justify-between gap-3">
            <GlassButton
              variant="ghost"
              icon={<ArrowLeft size={16} aria-hidden="true" />}
              onPointerDown={() => hapticLight()}
              onClick={() => onBack()}
              style={{ padding: 6, minHeight: "auto", minWidth: "auto" }}
              aria-label={T.athleteDetailBack}
            />
            <div className="flex items-center gap-3">
              <User size={24} strokeWidth={1.5} style={{ color: TEXT.tertiary }} aria-hidden="true" />
              <div className="flex flex-col">
                <p
                  style={{
                    margin: 0,
                    fontSize: TYPE.title2.size,
                    fontWeight: 700,
                    color: TEXT.primary,
                    wordBreak: "break-word",
                  }}
                >
                  {profile?.display_name ?? T.athleteDetailUnknown}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: TYPE.subhead.size,
                    fontWeight: 500,
                    color: TEXT.secondary,
                  }}
                >
                  Atleta asignado
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Segmented control */}
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: "rgba(24,24,27,0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
          onTouchStart={handleTabTouchStart}
          onTouchEnd={handleTabTouchEnd}
        >
          {(["ficha", "chat", "rutina"] as const).map((t) => (
            <button
              key={t}
              onPointerDown={() => setActiveTab(t)}
              onClick={() => {
                hapticLight();
                setActiveTab(t);
              }}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 999,
                background: activeTab === t ? "rgba(255,255,255,0.1)" : "transparent",
                color: TEXT.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontSize: TYPE.caption.size,
              }}
            >
              {t === "ficha" && <User size={14} />}
              {t === "chat" && <MessageSquare size={14} />}
              {t === "rutina" && <Dumbbell size={14} />}
              {t === "ficha" ? "Ficha" : t === "chat" ? "Chat" : "Rutina"}
            </button>
          ))}
        </div>

        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div
            style={{
              height: pullDistance,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: `2px solid ${TEXT.tertiary}`,
                borderTopColor: ACCENT.base,
                borderRadius: "50%",
                animation: `spin ${Math.max(600, 1200 - pullDistance * 4)}ms linear infinite`,
              }}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Perfil: objetivo, días, equipo, fase */}
        <GlassCard raised style={{ padding: SPACE.card }}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div style={statStyle}>
                <span style={statLabelStyle}>{T.athleteDetailGoal}</span>
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                  {parsed?.goal ?? profile?.goal ?? T.athleteDetailUnknown}
                </p>
              </div>
              <div style={statStyle}>
                <span style={statLabelStyle}>{T.athleteDetailDays}</span>
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                  {parsed?.days ?? T.athleteDetailUnknown}
                </p>
              </div>
              <div style={statStyle}>
                <span style={statLabelStyle}>{T.athleteDetailEquipment}</span>
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                  {parsed?.equipment ?? T.athleteDetailUnknown}
                </p>
              </div>
              <div style={statStyle}>
                <span style={statLabelStyle}>{T.athleteDetailPhase}</span>
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                  {phaseLabel}
                </p>
              </div>
              <div style={statStyle}>
                <span style={statLabelStyle}>Peso</span>
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                  {profile?.weight_kg ? `${profile.weight_kg} kg` : T.athleteDetailUnknown}
                </p>
              </div>
              <div style={statStyle}>
                <span style={statLabelStyle}>Altura</span>
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                  {profile?.height_cm ? `${profile.height_cm} cm` : T.athleteDetailUnknown}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Notas privadas del coach */}
        <GlassCard raised style={{ padding: SPACE.card }}>
          <div className="flex flex-col gap-2">
            <h4
              style={{
                margin: 0,
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
                color: TEXT.secondary,
              }}
            >
              {T.athleteDetailNotes}
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: TYPE.subhead.size,
                color: coachNotes ? TEXT.primary : TEXT.tertiary,
                whiteSpace: "pre-wrap",
              }}
            >
              {coachNotes ?? T.athleteDetailNoNotes}
            </p>
          </div>
        </GlassCard>

        {/* Chat en vivo */}
        <section className="flex min-h-0 flex-1 flex-col gap-3" aria-label={T.chatTitle}>
          <h3
            style={{
              margin: 0,
              fontSize: TYPE.callout.size,
              fontWeight: 600,
              color: TEXT.primary,
            }}
          >
            {T.chatTitle}
          </h3>
          {requestId ? (
            <HumanCoachChat requestId={requestId} userId={coachUserId} />
          ) : (
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
              {T.chatSelectPrompt}
            </p>
          )}
          {/* AI analyze button (Rutina tab) */}
          {activeTab === "rutina" && (
            <GlassButton
              variant="primary"
              icon={<Sparkles size={16} />}
              onPointerDown={() => hapticLight()}
              onClick={() => {}}
            >
              Analizar Atleta con IA
            </GlassButton>
          )}
        </section>
      </section>
    </div>
    <style>{`
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
      </>
  );
}

/** Una métrica del perfil: etiqueta encima, valor debajo. */
const statStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
} as const;

const statLabelStyle = {
  fontSize: TYPE.caption.size,
  fontWeight: 600,
  color: TEXT.tertiary,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
} as const;
