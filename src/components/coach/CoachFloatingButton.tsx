import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
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
        className={reducedMotion ? "coach-ai-fab" : "coach-ai-fab coach-ai-fab--enter coach-ai-fab--pulse"}
        onClick={() => setOpen(true)}
        aria-label={T.fabAriaLabel}
        data-testid="coach-fab"
      >
        <span className="coach-ai-fab__glow" aria-hidden="true" />
        <span className="coach-ai-fab__inner">
          <Sparkles size={22} aria-hidden="true" strokeWidth={1.8} />
        </span>
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