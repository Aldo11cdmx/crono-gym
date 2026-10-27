/**
 * AthletePhaseSelector.tsx — fase de entrenamiento de un atleta.
 *
 * Tres valores: descarga, mantenimiento, sobrecarga. El coach la elige para
 * sus atletas asignados y se guarda en `athlete_phases`. La fase es el único
 * dato de esta fila: una por atleta, upsert al cambiar.
 *
 * El selector usa `SegmentedControl`, el único control de este tipo en la app,
 * y los estados de carga/éxito/error siguen el contrato del portal.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ACCENT, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { getCoachId } from "@/lib/coach/useCoachAuth";
import { supabase } from "@lib/supabase";
import type { AthletePhaseRow } from "@/types/supabase";

export interface AthletePhaseSelectorProps {
  /** El atleta cuya fase se está editando. */
  athleteId: string | null;
}

export function AthletePhaseSelector({ athleteId }: AthletePhaseSelectorProps) {
  const coachId = getCoachId();
  const [phase, setPhase] = useState<"deload" | "maintenance" | "overload">("maintenance");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Lee la fase actual del atleta. */
  const load = useCallback(async () => {
    if (!athleteId) {
      setLoaded(true);
      return;
    }

    const { data, error: readError } = await supabase
      .from("athlete_phases")
      .select("phase")
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (!mounted.current) return;

    if (readError) {
      setError(T.phaseSaveError);
      setLoaded(true);
      return;
    }

    const row = data as AthletePhaseRow | null;
    setPhase((row?.phase ?? "maintenance") as "deload" | "maintenance" | "overload");
    setLoaded(true);
  }, [athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Guarda la fase: insert si no existe, update si ya hay fila. */
  const savePhase = useCallback(
    async (next: "deload" | "maintenance" | "overload") => {
      if (!athleteId || !coachId) return;
      if (saving) return;

      setSaving(true);
      setError(null);

      const existing = await supabase
        .from("athlete_phases")
        .select("athlete_id")
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (!mounted.current) {
        setSaving(false);
        return;
      }

      let result;
      if (existing.data) {
        result = await supabase
          .from("athlete_phases")
          .update({ phase: next, updated_at: new Date().toISOString() })
          .eq("athlete_id", athleteId);
      } else {
        result = await supabase.from("athlete_phases").insert({
          athlete_id: athleteId,
          phase: next,
        });
      }

      if (!mounted.current) {
        setSaving(false);
        return;
      }

      if (result.error) {
        setError(T.phaseSaveError);
        setSaving(false);
        return;
      }

      setPhase(next);
      setSaving(false);
    },
    [athleteId, coachId, saving],
  );

  if (athleteId === null) {
    return null;
  }

  if (!loaded) {
    return (
      <GlassCard style={{ padding: 20 }}>
        <Skeleton style={{ width: 200, height: 32 }} />
      </GlassCard>
    );
  }

  const options = [
    { value: "deload", label: T.phaseDeload },
    { value: "maintenance", label: T.phaseMaintenance },
    { value: "overload", label: T.phaseOverload },
  ];

  return (
    <section aria-labelledby="athlete-phase-heading" className="flex min-w-0 flex-col gap-3">
      <h3
        id="athlete-phase-heading"
        style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}
      >
        {T.phaseTitle}
      </h3>

      <GlassCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: TYPE.caption.size, fontWeight: 600, color: TEXT.tertiary }}>
              {T.phaseLabel}
            </span>
            <SegmentedControl
              value={phase}
              options={options}
              onChange={(value) => void savePhase(value as "deload" | "maintenance" | "overload")}
              ariaLabel={T.phaseLabel}
            />
          </div>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
              {error}
            </p>
          )}

          {saving && (
            <GlassButton variant="ghost" disabled>
              {T.phaseSaving}
            </GlassButton>
          )}
        </div>
      </GlassCard>
    </section>
  );
}
