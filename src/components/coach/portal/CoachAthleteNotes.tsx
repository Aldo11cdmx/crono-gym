/**
 * CoachAthleteNotes.tsx — notas privadas del coach para un atleta.
 *
 * Una fila por pareja (coach, atleta). El coach lee y escribe; el atleta nunca
 * la ve: RLS no le concede ninguna política, y la consulta filtra por el coach
 * autenticado para que el cliente nunca pida notas ajenas.
 *
 * Upsert por diseño: una sola fila por pareja, así que guardar es insert o
 * update según ya exista o no. No hay historial de versiones por ahora -- la
 * nota es el estado actual, y eso es suficiente para observaciones internas.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ACCENT, MOTION, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { getCoachId } from "@/lib/coach/useCoachAuth";
import { supabase } from "@lib/supabase";

export interface CoachAthleteNotesProps {
  /** El atleta cuyas notas se están editando. */
  athleteId: string | null;
}

export function CoachAthleteNotes({ athleteId }: CoachAthleteNotesProps) {
  const coachId = getCoachId();
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Carga la nota existente, si la hay. */
  const load = useCallback(async () => {
    if (!athleteId || !coachId) {
      setContent("");
      return;
    }

    const { data, error: readError } = await supabase
      .from("coach_notes")
      .select("content")
      .eq("coach_id", coachId)
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (!mounted.current) return;

    if (readError) {
      setError(T.coachNotesSaveError);
      return;
    }

    setContent((data ?? { content: "" }).content);
  }, [athleteId, coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Guarda la nota: insert si no existe, update si ya hay una. */
  const save = useCallback(async () => {
    if (!athleteId || !coachId) return;
    if (saving) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const existing = await supabase
      .from("coach_notes")
      .select("id")
      .eq("coach_id", coachId)
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (!mounted.current) {
      setSaving(false);
      return;
    }

    let result;
    if (existing.data && existing.data.id) {
      result = await supabase
        .from("coach_notes")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", existing.data.id);
    } else {
      result = await supabase.from("coach_notes").insert({
        coach_id: coachId,
        athlete_id: athleteId,
        content,
      });
    }

    if (!mounted.current) {
      setSaving(false);
      return;
    }

    if (result.error) {
      setError(T.coachNotesSaveError);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [athleteId, coachId, content, saving]);

  if (athleteId === null) {
    return (
      <GlassCard>
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {T.crmSelectPrompt}
        </p>
      </GlassCard>
    );
  }

  if (!coachId) {
    return (
      <GlassCard>
        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
          {T.builderNeedsCoach}
        </p>
      </GlassCard>
    );
  }

  return (
    <section aria-labelledby="coach-notes-heading" className="flex min-w-0 flex-col gap-3">
      <h3
        id="coach-notes-heading"
        style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}
      >
        {T.coachNotesTitle}
      </h3>

      <GlassCard>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={T.coachNotesPlaceholder}
          rows={6}
          style={{
            width: "100%",
            minHeight: 132,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${TEXT.tertiary}33`,
            background: "#ffffff08",
            color: TEXT.primary,
            fontSize: TYPE.subhead.size,
            resize: "vertical",
            transition: `border-color ${MOTION.fast} ${MOTION.easeOut}`,
          }}
        />

        <div className="flex items-center justify-between gap-3" style={{ marginTop: 12 }}>
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
              {error}
            </p>
          )}
          {!error && saved && (
            <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
              {T.coachNotesSaved}
            </p>
          )}
          <GlassButton
            variant="primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? T.coachNotesSaving : T.builderSave}
          </GlassButton>
        </div>

        <p style={{ margin: "8px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          {T.coachNotesOnlyCoach}
        </p>
      </GlassCard>
    </section>
  );
}
