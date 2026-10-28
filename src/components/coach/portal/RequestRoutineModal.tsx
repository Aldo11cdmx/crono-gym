/**
 * RequestRoutineModal.tsx — el atleta le pide una rutina a su coach.
 *
 * Wizard interactivo por pasos estilo Apple / iOS.
 * Al finalizar se envía todo el objeto recopilado a `coach_session_requests` con status 'pending'.
 */

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, X } from "lucide-react";

import { ACCENT, MOTION, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { supabase } from "@lib/supabase";

export interface RequestRoutineModalProps {
  /** El coach al que va dirigida la solicitud. */
  coachId: string;
  /** Si el modal está abierto. */
  open: boolean;
  /** Se dispara cuando el usuario cierra el modal. */
  onClose: () => void;
  /** Se dispara tras guardar con éxito. */
  onSuccess?: () => void;
}

type GoalValue = "hipertrofia" | "fuerza" | "perder_grasa" | "recomposicion";
type ExperienceLevel = "principiante" | "intermedio" | "avanzado";

const GOALS: Array<{ value: GoalValue; label: string }> = [
  { value: "hipertrofia", label: T.requestRoutineGoalHipertrofia },
  { value: "fuerza", label: T.requestRoutineGoalFuerza },
  { value: "perder_grasa", label: T.requestRoutineGoalGrasa },
  { value: "recomposicion", label: T.requestRoutineGoalRecomposicion },
];

const DAYS = [3, 4, 5, 6] as const;

const EXPERIENCE_LEVELS: Array<{ value: ExperienceLevel; label: string }> = [
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
];

const EQUIPMENT_OPTIONS = [
  { value: "barra", label: "Barra" },
  { value: "mancuernas", label: "Mancuernas" },
  { value: "maquinas", label: "Máquinas" },
  { value: "poleas", label: "Poleas" },
  { value: "peso_corporal", label: "Peso corporal" },
  { value: "kettlebell", label: "Kettlebell" },
] as const;

const ISSUES_OPTIONS = [
  { value: "hombros", label: "Hombros" },
  { value: "espalda", label: "Espalda" },
  { value: "rodillas", label: "Rodillas" },
  { value: "cadera", label: "Cadera" },
  { value: "munecas", label: "Muñecas" },
  { value: "ninguna", label: "Ninguna" },
] as const;

function buildFullRequestPayload(params: {
  goal: GoalValue | null;
  days: number | null;
  experienceLevel: ExperienceLevel | null;
  equipment: string[];
  issues: string[];
  notes: string;
}): string {
  const payload = {
    objetivo: params.goal,
    dias_semana: params.days,
    nivel_experiencia: params.experienceLevel,
    equipo_disponible: params.equipment,
    molestias_lesiones: params.issues,
    notas_adicionales: params.notes.trim() || null,
    equipo: T.requestRoutineEquipment,
    solicitud_en: new Date().toISOString(),
  };

  return JSON.stringify(payload, null, 2);
}

export function RequestRoutineModal({
  coachId,
  open,
  onClose,
  onSuccess,
}: RequestRoutineModalProps) {
  if (!open) return null;

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<GoalValue | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const totalSteps = 3;

  const toggleEquipment = useCallback((value: string) => {
    setEquipment((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const toggleIssue = useCallback((value: string) => {
    setIssues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const canContinueStep1 = goal !== null;
  const canContinueStep2 = days !== null && experienceLevel !== null;

  const handleNext = useCallback(() => {
    setError(null);
    if (step === 1 && !canContinueStep1) {
      setError(T.requestRoutineError);
      return;
    }
    if (step === 2 && !canContinueStep2) {
      setError(T.requestRoutineError);
      return;
    }
    if (step < totalSteps) {
      setStep((s) => s + 1);
      return;
    }
    // step 3 -> submit
    void submit();
  }, [step, canContinueStep1, canContinueStep2]);

  const handleBack = useCallback(() => {
    setError(null);
    if (step > 1) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const submit = useCallback(async () => {
    if (sending) return;
    if (goal === null || days === null || experienceLevel === null) return;

    setSending(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const athleteId = session?.user?.id;
      if (!athleteId) {
        setError(T.requestRoutineError);
        setSending(false);
        return;
      }

      const fullPayload = buildFullRequestPayload({
        goal,
        days,
        experienceLevel,
        equipment,
        issues,
        notes,
      });

      const payload = {
        athlete_id: athleteId,
        coach_id: coachId,
        status: "pending" as const,
        athlete_notes: fullPayload,
      };

      const { error: insertError } = await supabase
        .from("coach_session_requests")
        .insert(payload);

      if (insertError) {
        setError(T.requestRoutineError);
        setSending(false);
        return;
      }

      setSending(false);
      setSent(true);
      onSuccess?.();
    } catch {
      setError(T.requestRoutineError);
      setSending(false);
    }
  }, [coachId, days, goal, experienceLevel, equipment, issues, notes, sending, onSuccess]);

  const progressPercent = useMemo(() => (step / totalSteps) * 100, [step]);

  const isLastStep = step === totalSteps;

  if (!open) return null;

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
        background: "rgba(9, 9, 11, 0.8)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
        borderRadius: 24,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-routine-heading"
        id="request-routine-heading"
        style={{
          maxWidth: 420,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step > 1 && !sent && (
              <button
                type="button"
                aria-label="Atrás"
                onClick={handleBack}
                style={{
                  background: "none",
                  border: "none",
                  color: TEXT.secondary,
                  cursor: "pointer",
                  padding: 4,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <h2
              style={{
                margin: 0,
                fontSize: TYPE.title2.size,
                fontWeight: 700,
                color: TEXT.primary,
              }}
            >
              {T.requestRoutineTitle}
            </h2>
          </div>
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

        {/* Progress indicator */}
        {!sent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: TYPE.caption.size,
                  color: TEXT.tertiary,
                  fontWeight: 600,
                }}
              >
                Paso {step} de {totalSteps}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 2,
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: ACCENT.base,
                  transition: `width ${MOTION.normal} ${MOTION.easeOut}`,
                }}
              />
            </div>
          </div>
        )}

        {/* Step content with animation */}
        {!sent && (
          <div
            key={step}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              animation: "fadeSlideIn 300ms ease-out",
              minHeight: 280,
            }}
          >
            {step === 1 && (
              <>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: TYPE.subhead.size,
                      fontWeight: 600,
                      color: TEXT.primary,
                      marginBottom: 12,
                    }}
                  >
                    ¿Cuál es tu meta principal?
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Meta principal"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 10,
                    }}
                  >
                    {GOALS.map((g) => {
                      const selected = goal === g.value;
                      return (
                        <button
                          key={g.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setGoal(g.value)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "12px 14px",
                            borderRadius: 16,
                            border: selected
                              ? "1px solid rgba(255, 255, 255, 0.9)"
                              : "1px solid rgba(255, 255, 255, 0.12)",
                            background: selected
                              ? "rgba(255, 255, 255, 0.98)"
                              : "rgba(255, 255, 255, 0.02)",
                            color: selected ? "#000000" : TEXT.primary,
                            fontSize: TYPE.subhead.size,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                            boxShadow: selected
                              ? "0 8px 24px rgba(255, 255, 255, 0.12)"
                              : "none",
                            minHeight: 48,
                          }}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: TYPE.subhead.size,
                      fontWeight: 600,
                      color: TEXT.primary,
                      marginBottom: 12,
                    }}
                  >
                    Ritmo y Experiencia
                  </span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: TYPE.caption.size,
                          fontWeight: 600,
                          color: TEXT.tertiary,
                          marginBottom: 10,
                        }}
                      >
                        {T.requestRoutineDaysLabel}
                      </span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {DAYS.map((d) => {
                          const selected = days === d;
                          return (
                            <button
                              key={d}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setDays(d)}
                              style={{
                                minWidth: 48,
                                minHeight: 48,
                                borderRadius: 999,
                                border: selected
                                  ? "1px solid rgba(255, 255, 255, 0.9)"
                                  : "1px solid rgba(255, 255, 255, 0.12)",
                                background: selected
                                  ? "rgba(255, 255, 255, 0.98)"
                                  : "rgba(255, 255, 255, 0.02)",
                                color: selected ? "#000000" : TEXT.primary,
                                fontSize: TYPE.subhead.size,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                                boxShadow: selected
                                  ? "0 8px 24px rgba(255, 255, 255, 0.12)"
                                  : "none",
                                padding: "0 16px",
                              }}
                            >
                              {T.requestRoutineDays(d)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: TYPE.caption.size,
                          fontWeight: 600,
                          color: TEXT.tertiary,
                          marginBottom: 10,
                        }}
                      >
                        Nivel de experiencia
                      </span>
                      <div
                        role="radiogroup"
                        aria-label="Nivel de experiencia"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: 8,
                        }}
                      >
                        {EXPERIENCE_LEVELS.map((lvl) => {
                          const selected = experienceLevel === lvl.value;
                          return (
                            <button
                              key={lvl.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setExperienceLevel(lvl.value)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "10px 12px",
                                borderRadius: 999,
                                border: selected
                                  ? "1px solid rgba(255, 255, 255, 0.9)"
                                  : "1px solid rgba(255, 255, 255, 0.12)",
                                background: selected
                                  ? "rgba(255, 255, 255, 0.98)"
                                  : "rgba(255, 255, 255, 0.02)",
                                color: selected ? "#000000" : TEXT.primary,
                                fontSize: TYPE.subhead.size,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                                boxShadow: selected
                                  ? "0 8px 24px rgba(255, 255, 255, 0.12)"
                                  : "none",
                                minHeight: 44,
                              }}
                            >
                              {lvl.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: TYPE.subhead.size,
                      fontWeight: 600,
                      color: TEXT.primary,
                      marginBottom: 12,
                    }}
                  >
                    Detalles finales
                  </span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: TYPE.caption.size,
                          fontWeight: 600,
                          color: TEXT.tertiary,
                          marginBottom: 10,
                        }}
                      >
                        Equipo disponible
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {EQUIPMENT_OPTIONS.map((eq) => {
                          const selected = equipment.includes(eq.value);
                          return (
                            <button
                              key={eq.value}
                              type="button"
                              onClick={() => toggleEquipment(eq.value)}
                              style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                border: selected
                                  ? "1px solid rgba(255, 255, 255, 0.9)"
                                  : "1px solid rgba(255, 255, 255, 0.12)",
                                background: selected
                                  ? "rgba(255, 255, 255, 0.98)"
                                  : "rgba(255, 255, 255, 0.02)",
                                color: selected ? "#000000" : TEXT.primary,
                                fontSize: TYPE.subhead.size,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                                boxShadow: selected
                                  ? "0 6px 18px rgba(255, 255, 255, 0.1)"
                                  : "none",
                                minHeight: 40,
                              }}
                            >
                              {eq.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: TYPE.caption.size,
                          fontWeight: 600,
                          color: TEXT.tertiary,
                          marginBottom: 10,
                        }}
                      >
                        Molestias o lesiones (opcional)
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {ISSUES_OPTIONS.map((iss) => {
                          const selected = issues.includes(iss.value);
                          return (
                            <button
                              key={iss.value}
                              type="button"
                              onClick={() => toggleIssue(iss.value)}
                              style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                border: selected
                                  ? "1px solid rgba(255, 59, 48, 0.9)"
                                  : "1px solid rgba(255, 255, 255, 0.12)",
                                background: selected
                                  ? "rgba(255, 59, 48, 0.18)"
                                  : "rgba(255, 255, 255, 0.02)",
                                color: selected ? "#ff453a" : TEXT.primary,
                                fontSize: TYPE.subhead.size,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                                boxShadow: selected
                                  ? "0 6px 18px rgba(255, 59, 48, 0.15)"
                                  : "none",
                                minHeight: 40,
                              }}
                            >
                              {iss.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: TYPE.caption.size,
                          fontWeight: 600,
                          color: TEXT.tertiary,
                          marginBottom: 10,
                        }}
                      >
                        {T.requestRoutineNotesLabel}
                      </label>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={T.requestRoutineNotesPlaceholder}
                        rows={3}
                        style={{
                          width: "100%",
                          minHeight: 88,
                          padding: "10px 12px",
                          borderRadius: 16,
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                          background: "rgba(255, 255, 255, 0.02)",
                          color: TEXT.primary,
                          fontSize: TYPE.subhead.size,
                          resize: "vertical",
                          transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {error && !sent && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: TYPE.subhead.size,
              color: "#ff453a",
            }}
          >
            {error}
          </p>
        )}

        {!sent && (
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1 && (
              <GlassButton variant="ghost" onClick={handleBack}>
                Atrás
              </GlassButton>
            )}
            <GlassButton
              variant="primary"
              style={{
                flex: 1,
                borderRadius: 999,
              }}
              disabled={
                sending ||
                (step === 1 && !canContinueStep1) ||
                (step === 2 && !canContinueStep2)
              }
              onClick={() => void handleNext()}
            >
              {sending
                ? T.requestRoutineSending
                : isLastStep
                ? "Enviar solicitud"
                : "Continuar"}
            </GlassButton>
          </div>
        )}

        {sent && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              textAlign: "center",
              padding: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: TYPE.subhead.size,
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              {T.requestRoutineSuccess}
            </p>
            <GlassButton variant="ghost" onClick={onClose}>
              {T.requestRoutineClose}
            </GlassButton>
          </div>
        )}
      </section>

      <style>
        {`
          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </GlassCard>
  );
}
