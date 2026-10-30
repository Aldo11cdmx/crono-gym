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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Banknote, CheckCircle2, Dumbbell, MessageSquare, Mic, Sparkles, User } from "lucide-react";

import { ACCENT, GLASS, RADIUS, SPACE, STATUS, SURFACE_ROLE, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { HumanCoachChat } from "./HumanCoachChat";
import { supabase } from "@lib/supabase";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { parseAthleteNotes, phaseLabelFor } from "@/lib/coach/athleteNotes";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { getCoachId } from "@/lib/coach/useCoachAuth";
import { saveCoachRoutine } from "@/lib/routines/saveCoachRoutine";
import type { CoachRoutineDraft } from "@/lib/routines/coachRoutineDraft";
import { resolveExercise } from "@/lib/routines/routineTemplates";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { ROUTINE_TEMPLATES } from "@/lib/routines/routineTemplates";

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
    is_vip: boolean;
    vip_status: string | null;
    vip_activated_at: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [requestNotes, setRequestNotes] = useState<string | null>(null);
  const [phase, setPhase] = useState<"deload" | "maintenance" | "overload" | null>(null);
  const [activeTab, setActiveTab] = useState<"ficha" | "chat" | "rutina">("ficha");
  const [coachNotes, setCoachNotes] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vipActivating, setVipActivating] = useState(false);
  const [vipMessage, setVipMessage] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullStartY, setPullStartY] = useState<number | null>(null);

  const PULL_THRESHOLD = 80;
  const SWIPE_THRESHOLD = 50;

  const { exercises: catalog } = useExerciseCatalog();
  const [assigningTemplate, setAssigningTemplate] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const recognitionRef = useRef<any>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "es-MX";
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCoachNotes((prev) => (prev ?? "") + " " + transcript.trim());
      setIsListening(false);
    };
    recognitionRef.current.onerror = () => setIsListening(false);
    recognitionRef.current.onend = () => setIsListening(false);
    return () => {
      recognitionRef.current!.abort();
    };
  }, []);

  const startDictation = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || isListening) return;
    setIsListening(true);
    recognition.start();
  }, [isListening]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Perfil del atleta (nombre y objetivo guardado en onboarding)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, goal, weight_kg, height_cm, is_vip, vip_status, vip_activated_at, avatar_url")
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
        is_vip: typeof profileData?.is_vip === "boolean" ? profileData.is_vip : false,
        vip_status: typeof profileData?.vip_status === "string" ? profileData.vip_status : null,
        vip_activated_at:
          typeof profileData?.vip_activated_at === "string"
            ? profileData.vip_activated_at
            : null,
        avatar_url: typeof profileData?.avatar_url === "string" ? profileData.avatar_url : null,
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

  /**
   * Activa al atleta como VIP (pago en efectivo) a través del RPC
   * `activate_vip`, que verifica que el coach es activo y que el atleta tiene
   * una solicitud activa con él. Relee la ficha al terminar para reflejar el
   * estado sin pedirle al coach que pulse de nuevo.
   */
  const activateVip = useCallback(async () => {
    if (!athleteId || vipActivating || profile?.is_vip) return;
    setVipActivating(true);
    setVipMessage(null);
    setError(null);

    try {
      const { error: rpcError } = await (supabase as any).rpc("activate_vip", {
        target_user_id: athleteId,
      });
      if (rpcError) throw rpcError;

      hapticSuccess();
      setVipMessage(T.athleteVipActivated);
      await load();
    } catch (err) {
      setVipMessage(
        err instanceof Error ? err.message : T.athleteVipActivateError,
      );
    } finally {
      if (mounted.current) setVipActivating(false);
    }
  }, [athleteId, vipActivating, profile?.is_vip, load]);

  const resolveTemplateDays = useCallback(
    (template: (typeof ROUTINE_TEMPLATES)[number]) => {
      return template.days
        .map((day) => ({
          label: day.label,
          exercises: day.exercises
            .map((e) => {
              const found = resolveExercise(e.name, catalog);
              if (!found) return null;
              return {
                exerciseId: found.id,
                exerciseName: getExerciseDisplayName(found),
                sets: e.sets,
                repsMin: e.repsMin,
                repsMax: e.repsMax,
                restSeconds: e.restSeconds,
              };
            })
            .filter((ex): ex is { exerciseId: string; exerciseName: string; sets: number; repsMin: number; repsMax: number; restSeconds: number } => ex !== null),
        }))
        .filter((day) => day.exercises.length > 0);
    },
    [catalog],
  );

  const templatesWithDays: { template: (typeof ROUTINE_TEMPLATES)[number]; days: { label: string; exercises: { exerciseId: string; exerciseName: string; sets: number; repsMin: number; repsMax: number; restSeconds: number }[] }[] }[] = useMemo(
    () => ROUTINE_TEMPLATES.map((template) => ({ template, days: resolveTemplateDays(template) })),
    [resolveTemplateDays],
  );

  const handleAssignTemplate = useCallback(
    async (templateId: string) => {
      if (!athleteId) return;
      const coachId = getCoachId();
      if (!coachId) {
        setTemplateMessage({ kind: "error", text: T.builderNeedsCoach });
        return;
      }
      const entry = templatesWithDays.find((e) => e.template.id === templateId);
      if (!entry || entry.days.length === 0) {
        setTemplateMessage({
          kind: "error",
          text: "La plantilla no tiene ejercicios válidos en el catálogo.",
        });
        return;
      }
      setAssigningTemplate(templateId);
      setTemplateMessage(null);
      try {
        const draft: CoachRoutineDraft = { title: entry.template.title, days: entry.days };
        const ok = await saveCoachRoutine(athleteId, coachId, draft);
        if (!ok) {
          setTemplateMessage({ kind: "error", text: T.templateAssignError });
          return;
        }
        hapticSuccess();
        setTemplateMessage({ kind: "success", text: T.templateAssigned });
      } catch {
        setTemplateMessage({ kind: "error", text: T.templateAssignError });
      } finally {
        if (mounted.current) setAssigningTemplate(null);
      }
    },
    [athleteId, templatesWithDays],
  );

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

  const phaseLabel = phaseLabelFor(phase, {
    deload: T.phaseDeload,
    maintenance: T.phaseMaintenance,
    overload: T.phaseOverload,
    unknown: T.athleteDetailUnknown,
  });

  const goalValue = parsed?.objetivo ?? profile?.goal ?? T.athleteDetailUnknown;
  const daysValue = parsed?.dias_semana ?? T.athleteDetailUnknown;
  const equipmentValue = parsed?.equipo ?? T.athleteDetailUnknown;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.card, padding: SPACE.card }}>
        <Skeleton variant="block" height="64" style={{ borderRadius: RADIUS.card }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton variant="text" width="45%" style={{ borderRadius: RADIUS.sm }} />
          <Skeleton variant="text" width="65%" style={{ borderRadius: RADIUS.sm }} />
          <Skeleton variant="text" width="30%" style={{ borderRadius: RADIUS.sm }} />
        </div>
        <Skeleton variant="block" height="120" style={{ borderRadius: RADIUS.card }} />
        <Skeleton variant="block" height="88" style={{ borderRadius: RADIUS.card }} />
        <Skeleton variant="block" height="160" style={{ borderRadius: RADIUS.card }} />
      </div>
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
              <img
                src={profile?.avatar_url ?? CRONOS_AVATAR_FALLBACK}
                alt={T.athleteDetailAvatarAlt}
                width={32}
                height={32}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  objectFit: "cover",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${GLASS.border}`,
                  display: "block",
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== CRONOS_AVATAR_FALLBACK) {
                    target.src = CRONOS_AVATAR_FALLBACK;
                  }
                }}
              />
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

        {/* Perfil: objetivo, días, equipo, fase — solo en pestaña ficha */}
        {activeTab === "ficha" && (
          <GlassCard raised style={{ padding: SPACE.card }}>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div style={statStyle}>
                  <span style={statLabelStyle}>{T.athleteDetailGoal}</span>
                  <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                    {goalValue}
                  </p>
                </div>
                <div style={statStyle}>
                  <span style={statLabelStyle}>{T.athleteDetailDays}</span>
                  <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                    {daysValue}
                  </p>
                </div>
                <div style={statStyle}>
                  <span style={statLabelStyle}>{T.athleteDetailEquipment}</span>
                  <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary }}>
                    {equipmentValue}
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
        )}

        {/* Activación VIP (efectivo) — solo en pestaña ficha */}
        {activeTab === "ficha" && (
          <GlassCard raised style={{ padding: SPACE.card }}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Banknote size={18} strokeWidth={1.5} style={{ color: ACCENT.base }} aria-hidden="true" />
                  <h4
                    style={{
                      margin: 0,
                      fontSize: TYPE.subhead.size,
                      fontWeight: 600,
                      color: TEXT.primary,
                    }}
                  >
                    {T.athleteVipStatus}
                  </h4>
                </div>
                {profile?.is_vip ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: `${ACCENT.base}1f`,
                      border: `1px solid ${ACCENT.base}55`,
                      fontSize: TYPE.caption.size,
                      fontWeight: 600,
                      color: ACCENT.base,
                    }}
                  >
                    <CheckCircle2 size={12} aria-hidden="true" />
                    {profile.vip_status ?? T.athleteVipBadge}
                  </span>
                ) : null}
              </div>

              {profile?.is_vip ? (
                <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                  {T.athleteVipBadge}
                  {profile.vip_activated_at
                    ? ` · ${T.athleteVipActivatedAt} ${new Date(
                        profile.vip_activated_at,
                      ).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}`
                    : ""}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                    Activa la suscripción VIP cuando el atleta pague en efectivo. El coach
                    conserve el comprobante; el registro aquí es el registro del pago.
                  </p>
                  <GlassButton
                    variant="primary"
                    icon={<Banknote size={16} />}
                    disabled={vipActivating}
                    onClick={() => void activateVip()}
                    style={{ minHeight: 44 }}
                  >
                    {vipActivating ? "Activando…" : T.athleteVipActivate}
                  </GlassButton>
                  {vipMessage && (
                    <p
                      role={vipMessage === T.athleteVipActivated ? "status" : "alert"}
                      style={{
                        margin: 0,
                        fontSize: TYPE.caption.size,
                        color:
                          vipMessage === T.athleteVipActivated
                            ? STATUS.success.text
                            : STATUS.error.text,
                      }}
                    >
                      {vipMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Plantillas de rutina — solo en pestaña ficha */}
        {activeTab === "ficha" && templatesWithDays.length > 0 && (
          <GlassCard raised style={{ padding: SPACE.card }}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h4
                  style={{
                    margin: 0,
                    fontSize: TYPE.subhead.size,
                    fontWeight: 600,
                    color: TEXT.secondary,
                  }}
                >
                  {T.templateSectionTitle}
                </h4>
              </div>
              {templatesWithDays.map(({ template, days }) => (
                <div key={template.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: RADIUS.control,
                      border: `1px solid ${GLASS.border}`,
                      background: SURFACE_ROLE.well,
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                        {template.title}
                      </p>
                      <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                        {days.length} día{days.length > 1 ? "s" : ""} · {days.reduce((total, d) => total + d.exercises.length, 0)} ejercicio{days.reduce((total, d) => total + d.exercises.length, 0) > 1 ? "s" : ""}
                      </p>
                    </div>
                    <GlassButton
                      variant="primary"
                      disabled={assigningTemplate === template.id}
                      onPointerDown={() => hapticLight()}
                      onClick={() => void handleAssignTemplate(template.id)}
                      style={{ minHeight: 44 }}
                    >
                      {assigningTemplate === template.id ? "Asignando…" : T.templateAssign}
                    </GlassButton>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 16 }}>
                    {days.map((day) => (
                      <div key={day.label} style={{ marginLeft: 8 }}>
                        <p style={{ margin: 0, fontSize: TYPE.caption.size, fontWeight: 600, color: TEXT.secondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {day.label}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 8 }}>
                          {day.exercises.map((ex) => (
                            <div key={ex.exerciseId} style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                              <span>{ex.exerciseName}</span>
                              <span>{ex.sets}×{ex.repsMin}-{ex.repsMax} · {ex.restSeconds}s descanso</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
        {/* No hay plantillas disponibles */}
        {activeTab === "ficha" && templatesWithDays.length === 0 && ROUTINE_TEMPLATES.length > 0 && (
          <GlassCard raised style={{ padding: SPACE.card }}>
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
              {T.templateNoCatalog}
            </p>
          </GlassCard>
        )}

        {templateMessage && (
          <GlassCard raised style={{ padding: SPACE.card }}>
            <p
              role={templateMessage.kind === "success" ? "status" : "alert"}
              style={{
                margin: 0,
                fontSize: TYPE.subhead.size,
                color:
                  templateMessage.kind === "success" ? STATUS.success.text : STATUS.error.text,
              }}
            >
              {templateMessage.text}
            </p>
          </GlassCard>
        )}

        {/* Notas privadas del coach — solo en pestaña ficha */}
        {activeTab === "ficha" && (
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
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
                <textarea
                  value={coachNotes ?? ""}
                  onChange={(e) => setCoachNotes(e.target.value || null)}
                  placeholder={T.athleteDetailNoNotes}
                  rows={3}
                  style={{
                    flex: 1,
                    minHeight: 88,
                    padding: "10px 12px",
                    borderRadius: 16,
                    border: `1px solid ${GLASS.border}`,
                    background: SURFACE_ROLE.well,
                    color: TEXT.primary,
                    fontSize: TYPE.subhead.size,
                    resize: "vertical",
                  }}
                />
                <GlassButton
                  variant="ghost"
                  icon={<Mic size={16} aria-hidden="true" />}
                  onClick={startDictation}
                  style={{
                    padding: 6,
                    minHeight: "auto",
                    minWidth: "auto",
                    background: isListening ? ACCENT.base : "transparent",
                    color: isListening ? TEXT.onAccent : TEXT.secondary,
                  }}
                  aria-label={isListening ? T.coachNotesListening : T.coachNotesDictate}
                  disabled={!recognitionRef.current}
                />
              </div>
            </div>
          </GlassCard>
        )}

        {/* Chat en vivo — solo en pestaña chat */}
        {activeTab === "chat" && (
          <section
            className="flex min-h-0 flex-1 flex-col gap-3"
            aria-label={T.chatTitle}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
          >
            {requestId ? (
              <HumanCoachChat requestId={requestId} userId={coachUserId} />
            ) : (
              <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
                {T.chatSelectPrompt}
              </p>
            )}
          </section>
        )}

        {/* Rutina VIP — solo en pestaña rutina */}
        {activeTab === "rutina" && (
          <section className="flex min-h-0 flex-col gap-3" aria-label="Rutina del atleta">
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
                  Creador de rutina VIP
                </h4>
                <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                  Usa los datos de la ficha ({goalValue} · {daysValue} · {equipmentValue}) para
                  generar una rutina personalizada.
                </p>
              </div>
            </GlassCard>
            <GlassButton
              variant="primary"
              icon={<Sparkles size={16} />}
              onPointerDown={() => hapticLight()}
              onClick={() => {}}
            >
              Analizar Atleta con IA
            </GlassButton>
          </section>
        )}
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

/** Asset equivalente del proyecto para el avatar de mascota de Cronos. */
const CRONOS_AVATAR_FALLBACK = "/media/symmetry/img_profile_avatar.png";
