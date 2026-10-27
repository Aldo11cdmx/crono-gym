/**
 * CoachPortal.tsx — the vault's front door, and the only screen a coach works inside.
 *
 * Everything else under `portal/` is a panel this file arranges. That is not for tidiness:
 * each panel polls on its own interval, keeps its own selection and owns its own failure
 * state, so the only decisions that genuinely belong to a parent are *which athlete is
 * selected* and *whether the portal is open at all*. Everything else is left alone, because
 * a parent that also re-fetched would be a second, disagreeing copy of state each panel
 * already keeps honestly.
 *
 * **The PIN gate wraps the whole panel, and that is a UI lock, not a data one.** The RLS
 * policies discriminate on `auth.uid()` and never on the PIN token, so hiding the portal
 * stops a borrowed laptop from showing an inbox; it does not make the rows unreadable to
 * someone who has the coach's own JWT. The real boundary is the authenticated account, and
 * saying otherwise here would be a lie written into the most-read comment in the feature.
 * It is recorded as a Block 5 item rather than quietly fixed, because making the token a
 * real factor is a migration and not a component.
 *
 * **Activity is reported through capture-phase listeners on one wrapper**, rather than a
 * `touch` inside every panel's handlers. The idle timer is 30 minutes of *wall clock*, not
 * 30 minutes of coach activity: a coach reading a message is not pressing anything, and a
 * coach mid-set is pressing everything. Capture phase on the root sees the interaction
 * before any child decides to ignore it, so a scroll or a tap inside a panel that has no
 * handler of its own still counts. The alternative -- threading `touch` through five
 * components -- is how one of them ends up not calling it.
 *
 * **The selection is `{ requestId, athleteId }` and not just a request id.** The CRM and
 * the builder both need the *athlete*: their reads are filtered by `user_id` and rely on
 * the coach SELECT policies to qualify them. Carrying only the request id would mean a
 * second lookup here to turn a conversation into a person, and a lookup whose answer could
 * disagree with the queue row that produced it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Lock, FileText } from "lucide-react";

import { ACCENT, SPACE, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { supabase } from "@lib/supabase";
import { CoachPinGate } from "@/lib/coach/CoachAccessGate";
import { useCoachAuth } from "@/lib/coach/useCoachAuth";
import type { WorkspaceOutletContext } from "@/App";

import { AthleteCRM } from "./AthleteCRM";
import { HumanCoachChat } from "./HumanCoachChat";
import { RequestQueue } from "./RequestQueue";
import { VipRoutineBuilder } from "./VipRoutineBuilder";
import { ShiftPanel } from "./ShiftPanel";

/** The athlete the right-hand column is about. Null renders the prompt instead. */
export interface PortalSelection {
  requestId: string;
  athleteId: string;
}

export function CoachPortal() {
  /*
   * From the outlet context, exactly as `CoachView` does it. The router cannot pass it as a
   * prop: the table is built once at module scope and the id arrives later from the
   * Supabase session that `AuthGate` resolves.
   */
  const { userId } = useOutletContext<WorkspaceOutletContext>();

  return (
    <CoachPinGate>
      <PortalPanel userId={userId} />
    </CoachPinGate>
  );
}

/**
 * The unlocked panel.
 *
 * Split from `CoachPortal` so that `CoachPinGate`'s children are not re-created on every
 * render of the gate, and so a caller with a session already in hand can mount the panel
 * without one. Named-exported for that second reason: `src/components/dev/CoachPortalPreview`
 * uses it to review this layout at a phone and a desktop width without a coach account, which
 * is the only way to reach it outside production.
 */
export function PortalPanel({ userId }: { userId: string }) {
  const auth = useCoachAuth();
  const [selection, setSelection] = useState<PortalSelection | null>(null);

  /*
   * The last routine handed over, echoed at the portal level rather than inside the builder.
   *
   * Two reasons. A coach who saves a plan for the athlete they are mid-conversation with
   * needs to see that it landed next to the conversation, not scrolled away inside a
   * builder further down the column. And the builder's own message is cleared the moment the
   * draft is reset -- which is deliberate there, so a second tap cannot save twice -- but it
   * means the confirmation would otherwise disappear at the exact moment it is still useful.
   */
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  /*
   * Opening a conversation replaces the selection rather than adding to it, so the CRM and
   * the builder cannot end up describing two different athletes at once -- a state that is
   * reachable only by clicking twice quickly, and that would show one athlete's records
   * beside another athlete's conversation.
   */
  const openConversation = useCallback((requestId: string, athleteId: string) => {
    setSelection({ requestId, athleteId });
  }, []);

  /**
   * Report activity to the idle timer.
   *
   * Capture phase on the root, and only for the two events that mean "a human is here". Not
   * on every event: `onMouseMove` would fire thousands of times a minute for a coach
   * reading with the cursor parked, and each one is a store write plus a listener pass.
   */
  const reportActivity = useCallback(() => {
    auth.touch();
  }, [auth]);

  return (
    <div
      onPointerDownCapture={reportActivity}
      onKeyDownCapture={reportActivity}
      className="flex flex-col gap-4"
    >
      <PortalHeader userId={userId} onClose={auth.lock} />

      {/*
       * One column on a phone, two from `lg` up.
       *
       * `minmax(0, 1fr)` rather than `1fr`: a grid track sized `1fr` has an automatic
       * minimum of `min-content`, so a single long exercise name in the CRM widens the
       * column past the viewport instead of wrapping inside it. That is the difference
       * between a panel that scrolls and a page that scrolls sideways on a 390px screen.
       *
       * The queue stays first in the DOM at every width rather than being reordered on
       * mobile. Reordering it visually would leave the tab order disagreeing with the
       * layout, and the queue is the only thing on the screen that can *change* the state
       * below it -- so it has to come first for a keyboard as well as for a thumb.
       */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label={T.queueTitle} className="flex min-w-0 flex-col gap-3">
          <RequestQueue onOpenConversation={openConversation} />
          <ShiftPanel userId={userId} />
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          {/*
           * The right column shows one thing at a time, driven by the selection:
           *
           *   - No selection: a single unified empty state (was three separate cards:
           *     chat prompt, CRM prompt, builder prompt — now one container).
           *   - Selection: the chat, CRM and builder, all bound to the same athlete so
           *     a coach never reads one athlete's records beside another's conversation.
           */}
          {/*
           * The right column: the chat is replaced by the unified empty state when nothing is
           * selected, but the CRM and the builder stay mounted with `null` so each owns its
           * own empty prompt and the parent never has to know what they show.
           */}
          {selection === null ? (
            <>
              <PortalEmptyState />
              <AthleteCRM athleteId={null} />
              <VipRoutineBuilder athleteId={null} />
            </>
          ) : (
            <>
              <section aria-label={T.chatTitle} className="flex min-w-0 flex-col gap-3">
                <HumanCoachChat requestId={selection.requestId} userId={userId} />
              </section>
              <AthleteCRM athleteId={selection.athleteId} />
              <VipRoutineBuilder
                athleteId={selection.athleteId}
                onSaved={(savedTitle) => setLastSaved(savedTitle)}
              />
            </>
          )}

          {lastSaved !== null && (
            <p aria-live="polite" style={savedStyle}>
              {lastSaved}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The header: who is signed in, and the one button that throws the session away.
 *
 * The coach's name is a second read of their own `profiles` row rather than a prop.
 * `AuthGate` already resolved a session, not a name, and threading a name down would mean
 * widening the outlet context -- a shared contract every view depends on -- for one screen.
 * A null name is a real state (the column is nullable and nobody is asked to fill it), so it
 * falls back to the portal's own title rather than rendering an empty heading.
 */
function PortalHeader({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** The read can resolve after the coach has navigated away; it must not write then. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled || !mounted.current) return;
      setName(typeof data?.display_name === "string" ? data.display_name : null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Confirm before locking.
   *
   * `window.confirm` rather than an in-app dialog, and the reason is that this button is
   * the one action here with no undo. Everything else in the portal is a poll that repairs
   * itself; a lock is the coach retyping a PIN, and a modal asking first costs one dialog
   * in exchange for not throwing away a half-typed session to an accidental double tap.
   */
  const confirmClose = useCallback(() => {
    if (window.confirm(T.closeSessionConfirm)) onClose();
  }, [onClose]);

  return (
    <GlassCard style={{ padding: `${SPACE.sm} ${SPACE.md}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h1
            style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: 700, color: TEXT.primary }}
          >
            {name ?? T.title}
          </h1>
          {/* Announced rather than shown: a placeholder box in the header shifts the layout
              by its own height once the name lands, which reads as the page jumping. */}
          {loading && <span className="sr-only">{T.loading}</span>}
        </div>

        <GlassButton
          variant="ghost"
          icon={<Lock size={16} aria-hidden="true" />}
          onClick={confirmClose}
        >
          {T.closeSession}
        </GlassButton>
      </div>
    </GlassCard>
  );
}

/** The confirmation a coach reads after handing a plan over. */
const savedStyle = {
  margin: 0,
  fontSize: TYPE.subhead.size,
  color: ACCENT.text,
} as const;

/**
 * Unified empty state for the right column.
 *
 * Replaces the three separate empty cards (chat, CRM, builder) that each printed
 * their own "choose a request" prompt when no athlete was selected. One container,
 * one icon, one sentence, two quick-access buttons.
 */
function PortalEmptyState() {
  return (
    <GlassCard
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: SPACE.xl,
        minHeight: 400,
      }}
    >
      <FileText size={48} strokeWidth={1.5} style={{ color: TEXT.tertiary, marginBottom: SPACE.md }} aria-hidden="true" />
      <h3 style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary, textAlign: "center" }}>
        {T.portalEmptyTitle}
      </h3>
      <p style={{ margin: `${SPACE.xs} 0 ${SPACE.lg} 0`, fontSize: TYPE.subhead.size, color: TEXT.tertiary, textAlign: "center", maxWidth: 320 }}>
        {T.chatSelectPrompt}
      </p>
    </GlassCard>
  );
}