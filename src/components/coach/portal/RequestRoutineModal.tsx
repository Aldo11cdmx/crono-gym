/**
 * RequestRoutineModal.tsx — el atleta le pide una rutina a su coach.
 *
 * Un solo modal con tres datos: objetivo, días a la semana y notas opcionales.
 * No se pregunta el equipo: se asume el gym completo y se guarda así en el payload.
 * Al enviar se inserta una fila en `coach_session_requests` con `status = 'pending'`
 * y se le avisa al atleta de que su coach ya la recibió.
 */

import { useCallback, useState } from "react";
import { X } from "lucide-react";

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

const GOALS = [
  { value: "hipertrofia", label: T.requestRoutineGoalHipertrofia },
  { value: "fuerza", label: T.requestRoutineGoalFuerza },
  { value: "perder_grasa", label: T.requestRoutineGoalGrasa },
  { value: "recomposicion", label: T.requestRoutineGoalRecomposicion },
] as const;

const DAYS = [3, 4, 5, 6] as const;

function formatNotes(
  goal: string,
  days: number,
  notes: string | null,
): string {
  const lines = [
    `Objetivo: ${goal}`,
    `Días a la semana: ${days}`,
    `Equipo: ${T.requestRoutineEquipment}`,
  ];
  if (notes && notes.trim() !== "") {
    lines.push(`Notas: ${notes.trim()}`);
  }
  return lines.join("\n");
}

export function RequestRoutineModal({
  coachId,
  open,
  onClose,
  onSuccess,
}: RequestRoutineModalProps) {
  if (!open) return null;

  const [goal, setGoal] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = useCallback(async () => {
    if (sending) return;
    if (goal === null || days === null) return;

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

      const payload = {
        athlete_id: athleteId,
        coach_id: coachId,
        status: "pending" as const,
        athlete_notes: formatNotes(goal, days, notes || null),
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
  }, [coachId, days, goal, notes, sending, onSuccess]);

  const canSubmit = goal !== null && days !== null && !sending && !sent;

  const goalSelected = (value: string) => setGoal(value);
  const daySelected = (value: number) => setDays(value);

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
        }}
      >
        <div className="flex items-center justify-between gap-2">
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

        {/* Objetivo */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: TYPE.caption.size,
              fontWeight: 600,
              color: TEXT.tertiary,
              marginBottom: 8,
            }}
          >
            {T.requestRoutineGoalLabel}
          </span>
          <div
            role="radiogroup"
            aria-label={T.requestRoutineGoalLabel}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {GOALS.map((g) => (
              <button
                key={g.value}
                type="button"
                role="radio"
                aria-checked={goal === g.value}
                onClick={() => goalSelected(g.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${
                    goal === g.value ? ACCENT.base : TEXT.tertiary
                  }33`,
                  background: goal === g.value ? ACCENT.base : "transparent",
                  color: goal === g.value ? TEXT.onAccent : TEXT.primary,
                  fontSize: TYPE.subhead.size,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Días a la semana */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: TYPE.caption.size,
              fontWeight: 600,
              color: TEXT.tertiary,
              marginBottom: 8,
            }}
          >
            {T.requestRoutineDaysLabel}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={days === d}
                onClick={() => daySelected(d)}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 12,
                  border: `1px solid ${
                    days === d ? ACCENT.base : TEXT.tertiary
                  }33`,
                  background: days === d ? ACCENT.base : "transparent",
                  color: days === d ? TEXT.onAccent : TEXT.primary,
                  fontSize: TYPE.subhead.size,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: `all ${MOTION.fast} ${MOTION.easeOut}`,
                }}
              >
                {T.requestRoutineDays(d)}
              </button>
            ))}
          </div>
        </div>

        {/* Notas opcionales */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: TYPE.caption.size,
              fontWeight: 600,
              color: TEXT.tertiary,
              marginBottom: 8,
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
              padding: "8px 10px",
              borderRadius: 10,
              border: `1px solid ${TEXT.tertiary}33`,
              background: "#ffffff08",
              color: TEXT.primary,
              fontSize: TYPE.subhead.size,
              resize: "vertical",
            }}
          />
        </div>

        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: TYPE.subhead.size,
              color: ACCENT.text,
            }}
          >
            {error}
          </p>
        )}

        {!sent && (
          <GlassButton
            variant="primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {sending ? T.requestRoutineSending : T.requestRoutineSubmit}
          </GlassButton>
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
    </GlassCard>
  );
}
