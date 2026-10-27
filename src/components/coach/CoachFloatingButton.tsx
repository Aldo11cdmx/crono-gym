/**
 * CoachFloatingButton.tsx — disparador de "Cronos IA".
 *
 * Cápsula flotante horizontal estilo iOS que se sitúa sobre el MobileNav
 * respetando `--cronos-nav-height`. Un único foco visual: el nombre "Cronos IA"
 * con el icono de chispa `✦` y un indicador brillante de pulso neón. Al tocarlo
 * se abre el asistente (CronosBottomSheet, ahora en modo pantalla completa).
 */

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ACCENT, TEXT } from "@/design/tokens";
import { CRONOS_LABELS as T } from "@/lib/i18n";
import { CronosBottomSheet } from "./CronosBottomSheet";

export const COACH_PORTAL_PATH = "/coach/portal";
const WORKOUT_PATH = "/entrenar";
export const FAB_Z_INDEX = 55;

export interface CoachFloatingButtonProps {
  userId?: string | null;
}

export function CoachFloatingButton({ userId }: CoachFloatingButtonProps = {}) {
  const { pathname } = useLocation();
  const { session } = useActiveSession();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const [resolved, setResolved] = useState<string | null | undefined>(userId);
  const answer = userId !== undefined ? userId : resolved;

  useEffect(() => {
    if (userId !== undefined) {
      setResolved(userId);
      return;
    }
    let alive = true;
    void resolveUserId().then((id) => {
      if (alive) setResolved(id);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const initialContext =
    pathname === WORKOUT_PATH && session !== null ? session.title : null;

  if (answer === undefined || answer === null) return null;
  if (pathname === COACH_PORTAL_PATH) return null;

  return (
    <>
      <button
        type="button"
        className={[
          "fixed right-4 z-[55]",
          "bottom-[calc(24px+var(--cronos-nav-height,56px)+16px)]",
          "bg-neutral-900/95 border border-white/15 backdrop-blur-xl",
          "rounded-full px-4 py-2 flex items-center gap-2",
          "transition-colors cursor-pointer",
          !reducedMotion ? "" : "animate-none",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setOpen(true)}
        aria-label={T.fabAriaLabel}
        data-testid="coach-fab"
      >
        <span aria-hidden="true" style={{ color: ACCENT.base }}>
          ✦
        </span>
        <span className="text-sm font-medium leading-none" style={{ color: TEXT.primary }}>
          Cronos IA
        </span>
        <span
          aria-hidden="true"
          className={`w-2 h-2 rounded-full ${!reducedMotion ? "animate-pulse" : ""}`}
          style={{ backgroundColor: ACCENT.base }}
        />
      </button>

      {open && (
        <CronosBottomSheet
          open
          onClose={() => setOpen(false)}
          userId={answer}
          initialContext={initialContext}
        />
      )}
    </>
  );
}

async function resolveUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}
