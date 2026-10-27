/**
 * CoachBanner.tsx — tarjeta del coach asignado al atleta en el dashboard.
 *
 * Lee la fila de `coaches` por `coachId` y muestra su nombre, su estado de
 * disponibilidad en vivo (`is_available`) y un botón destacado para pedir una
 * nueva rutina. Al hacer clic, el caller abre `RequestRoutineModal` con ese
 * `coachId`.
 *
 * RLS ya acota lo que el atleta puede ver: si el coach no lee, el banner se
 * oculta silenciosamente en vez de mostrar un estado vacío confuso.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "lucide-react";

import { GLASS, RADIUS, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { supabase } from "@lib/supabase";

export interface CoachBannerProps {
  /** El id del coach asignado a este atleta. */
  coachId: string;
  /** Se dispara cuando el atleta pide una nueva rutina. */
  onRequestRoutine: () => void;
}

export function CoachBanner({ coachId, onRequestRoutine }: CoachBannerProps) {
  const [coach, setCoach] = useState<{
    display_name: string;
    is_available: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: readError } = await supabase
        .from("coaches")
        .select("display_name, is_available")
        .eq("id", coachId)
        .maybeSingle();

      if (!mounted.current) return;

      if (readError) {
        setError(readError.message);
        setLoading(false);
        return;
      }

      setCoach(data ?? null);
      setLoading(false);
    } catch {
      if (!mounted.current) return;
      setError("No se pudo cargar la información del coach.");
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <GlassCard raised style={{ padding: SPACE.card }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
          }}
        >
          <div style={{ height: 12, width: "40%", borderRadius: RADIUS.control, background: GLASS.fill }} />
          <div style={{ height: 12, width: "20%", borderRadius: RADIUS.control, background: GLASS.fill }} />
        </div>
      </GlassCard>
    );
  }

  if (!coach || error) {
    return null;
  }

  const isAvailable = coach.is_available;
  const statusColor = isAvailable ? STATUS.success.text : TEXT.tertiary;
  const statusLabel = isAvailable ? T.coachBannerAvailable : T.coachBannerUnavailable;

  return (
    <GlassCard raised style={{ padding: SPACE.card }}>
      <div className="flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <User size={20} strokeWidth={1.5} style={{ color: TEXT.tertiary }} aria-hidden="true" />
          <div className="flex flex-col">
            <p
              style={{
                margin: 0,
                fontSize: TYPE.callout.size,
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              {T.coachBannerTitle}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: TYPE.subhead.size,
                fontWeight: 500,
                color: TEXT.primary,
                wordBreak: "break-word",
              }}
            >
              {coach.display_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor }} />
            <span
              style={{
                fontSize: TYPE.caption.size,
                fontWeight: 600,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <GlassButton
            variant="primary"
            icon={<User size={14} />}
            onClick={() => void onRequestRoutine()}
            style={{ minHeight: 40 }}
          >
            {T.coachBannerRequestRoutine}
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
}
