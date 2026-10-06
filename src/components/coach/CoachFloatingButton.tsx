/**
 * CoachFloatingButton.tsx — the way into Symmetry from anywhere in the app.
 *
 * Mounted once, in the shell, rather than on each screen. The alternative is a button per
 * route and six chances for one of them to be missing; the button is the product's main
 * doorway to a feature that is free for everyone, and a doorway that is sometimes absent is
 * a doorway nobody finds.
 *
 * Three rules decide when it exists, and all three are the same rule read from different
 * sides: Symmetry is a feature *for an athlete*, so the button exists exactly when there is
 * an athlete, and not on the one screen that already has its own way in.
 *
 *  1. **Not while signed out.** The assistant reads the athlete's own records; with no
 *     athlete there is no conversation to resume, and an assistant that greets a stranger
 *     on the login screen is a worse first impression than no assistant at all.
 *
 *  2. **Not on `/coach/portal`.** That screen is the human coach's workspace, with its own
 *     chrome and its own lock. A floating "ask the AI" button over it is noise, and worse,
 *     it lands on top of the portal's primary action.
 *
 *  3. **Everywhere else**, mounted or not.
 *
 * Everything else -- the sheet, the context it loads, the catalog -- is not this
 * component's business. It owns a boolean and a link.
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ACCENT, TEXT, Z_INDEX } from "@/design/tokens";
import { supabase } from "@lib/supabase";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SYMMETRY_LABELS as T } from "@/lib/i18n";
import { SymmetryBottomSheet } from "./SymmetryBottomSheet";

/** The route the button must not appear on. Exported so a test can assert against it. */
export const COACH_PORTAL_PATH = "/coach/portal";

/** The route where an in-progress session becomes useful context for the assistant. */
const WORKOUT_PATH = "/entrenar";

/**
 * Where the button sits in the stacking order.
 *
 * Over the navigation (`modal`, 60) and under anything that is genuinely modal
 * (`popover`, 70). Derived rather than typed so a change to the scale moves it with
 * everything else instead of leaving one hardcoded 65 behind.
 */
export const FAB_Z_INDEX = Z_INDEX.modal + 5;

export interface CoachFloatingButtonProps {
  /**
   * The signed-in athlete's id, or null for nobody.
   *
   * Optional because the shell sits outside the auth gate and would otherwise have to
   * resolve the session a second time. When omitted, the button resolves the id itself --
   * once, on mount -- and renders nothing until it has an answer, because "not yet known"
   * and "nobody" are different states and only one of them should put a button on screen.
   */
  userId?: string | null;
}

export function CoachFloatingButton({ userId }: CoachFloatingButtonProps = {}) {
  const { pathname } = useLocation();
  const { session } = useActiveSession();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  // `undefined` until the answer is in, which is what suppresses the button on first paint
  // for the caller that did not supply an id.
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

  /*
   * Only on the workout route, and only when a session is actually running. A routine name
   * with nothing being trained is a label, not context: it would tell the assistant about a
   * session that is not happening. The route check is deliberate too -- on `/perfil` the
   * same session is usually still set, and naming a routine the athlete is not doing there
   * is actively misleading.
   */
  const initialContext =
    pathname === WORKOUT_PATH && session !== null ? session.title : null;

  if (answer === undefined || answer === null) return null;
  if (pathname === COACH_PORTAL_PATH) return null;

  return (
    <>
      <button
        type="button"
        className={reducedMotion ? "symmetry-fab" : "symmetry-fab symmetry-fab--enter"}
        onClick={() => setOpen(true)}
        aria-label={T.fabAriaLabel}
        style={{
          backgroundColor: ACCENT.base,
          color: TEXT.onAccent,
          zIndex: FAB_Z_INDEX,
        }}
        data-testid="coach-fab"
      >
        <Sparkles size={24} aria-hidden="true" />
      </button>

      {/*
        Rendered only while open, and closed by unmounting rather than by a prop. The chat
        loads a transcript on mount and the wizard holds a wizard's worth of state, so a
        sheet that stayed mounted would keep both alive behind the button -- and a
        half-finished wizard would reappear a week later, inside a conversation.
      */}
      {open && (
        <SymmetryBottomSheet
          open
          onClose={() => setOpen(false)}
          userId={answer}
          initialContext={initialContext}
        />
      )}
    </>
  );
}

/**
 * The signed-in id, or null. Never throws.
 *
 * A plain read rather than a subscription: the shell already re-renders the whole tree
 * when the route changes, and the id cannot change underneath a signed-in session without
 * a reload. A `onAuthStateChange` listener here would be a second source of truth that
 * only had to be kept in step.
 */
async function resolveUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}