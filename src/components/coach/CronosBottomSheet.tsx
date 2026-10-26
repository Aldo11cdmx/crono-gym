/**
 * CronosBottomSheet.tsx — the assistant, in a sheet over whatever the athlete is doing.
 *
 * A sheet rather than a route, and the reason is that the athlete is usually *in the
 * middle of something*. Asking "¿subo peso?" while the set logger is open means the
 * question and the answer are on the same screen; navigating away to ask and navigating
 * back to act is two round trips through a loading state for something that takes ten
 * seconds.
 *
 * The behaviours that are not obvious, and why they are here:
 *
 *  1. **The panel is a focus trap and Escape closes it.** A dialog the keyboard can walk
 *     out of is not a dialog: focus lands behind the overlay on a screen the athlete
 *     cannot see, and Tab then scrolls a page they cannot read. `aria-modal` alone only
 *     changes what a screen reader announces.
 *
 *  2. **Three ways to close, because there are three ways people try.** The button, the
 *     overlay and a downward swipe. Overlay-only is a desktop convention; a thumb on a
 *     phone reaches for the swipe.
 *
 *  3. **Nothing is mounted while it is closed.** Not hidden with `display: none` -- not
 *     mounted at all. `CoachChat` loads a transcript and subscribes to storage on mount,
 *     and the wizard holds a wizard's worth of state; keeping either alive in a hidden
 *     tree would mean a stale conversation behind the FAB and a wizard that opens
 *     mid-flow a week later.
 *
 * The height is CSS rather than inline because the numbers are responsive (85vh on a
 * phone, a 640px dialog on a desktop) and a style prop cannot express a media query.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from "react";
import { X } from "lucide-react";
import { ACCENT, MOTION, RADIUS, SPACE, TEXT, Z_INDEX } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CRONOS_LABELS as T } from "@/lib/i18n";
import { useGymSettings } from "@/context/GymSettingsContext";
import { useCoachContext } from "@/hooks/useCoach";
import type { Exercise } from "@/types/supabase";
import { CoachChat } from "./CoachChat";
import { RoutineGeneratorWizard } from "./RoutineGeneratorWizard";

/** The two tabs. A discriminant, so a tab cannot be set to a number that does not exist. */
export type CronosTab = "chat" | "generate";

export interface CronosBottomSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * The signed-in athlete, or null while unknown.
   *
   * Null renders the sheet without a conversation rather than with an error: there is no
   * history to show and nothing to generate for, and the caller decides what an
   * unidentified athlete should see.
   */
  userId: string | null;
  /**
   * What the athlete was doing when they opened it, as one line.
   *
   * Set from the active session on `/entrenar` so "mi rutina" means the routine in front
   * of them rather than whatever the model last heard about. It is shown, not sent: the
   * chat's context is built from the training record, and a free-text note injected into
   * it would be an instruction arriving dressed as data.
   */
  initialContext?: string | null;
  /** Exercises the generator may name. Already loaded by the caller, if it has them. */
  catalog?: Pick<Exercise, "id" | "body_part">[];
  exerciseNames?: Readonly<Record<string, string>>;
  /** The tab to open on. Defaults to the conversation. */
  initialTab?: CronosTab;
}

/** Focusable, in DOM order. Matches what `querySelectorAll` returns, so order is honest. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** How far a downward drag has to go before it counts as a dismissal, in px. */
const SWIPE_DISMISS_PX = 64;

export function CronosBottomSheet({
  open,
  onClose,
  userId,
  initialContext = null,
  catalog = [],
  exerciseNames,
  initialTab = "chat",
}: CronosBottomSheetProps) {
  const [tab, setTab] = useState<CronosTab>(initialTab);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  // Reset on open so the previous visit's tab does not greet someone who came back for a
  // conversation. Guarded by `open` rather than by an effect that runs on every render.
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  /**
   * Focus, on open and on close.
   *
   * Moved into the panel on open and back to whatever had it before on close, which is
   * the part most sheets skip: closing a dialog and leaving focus on `document.body`
   * sends the next Tab from the top of the page, so the athlete loses their place.
   */
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    panelRef.current?.focus();
    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  /**
   * Escape closes; Tab stays inside.
   *
   * On `document` rather than on the panel, because a keydown that started inside the
   * panel and ended on the overlay -- or on `body` after the browser moved focus past the
   * last control -- would never reach a handler bound to the panel. Bubbling from
   * `document` is the only place that catches all of those.
   */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      /*
       * `[hidden]` and not `offsetParent`: the latter is what the usual recipe uses to skip
       * hidden controls, and it is also always `null` under jsdom, which would make the trap
       * silently untestable. An ancestor marked `hidden` is the only thing in this panel
       * that can hide a control, and it is explicit.
       */
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.closest("[hidden]"),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const onTouchStart = useCallback((event: TouchEvent) => {
    dragStartRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      const end = event.changedTouches[0]?.clientY;
      if (start === null || end === undefined) return;
      // Downward only. An upward swipe is somebody trying to scroll the conversation.
      if (end - start > SWIPE_DISMISS_PX) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className={reducedMotion ? "symmetry-overlay" : "symmetry-overlay symmetry-overlay--animate"}
      style={{ zIndex: Z_INDEX.sheet }}
      // A click on the backdrop, not on the panel. The panel stops propagation itself, so
      // this only fires for the backdrop without a hit-test on coordinates that would go
      // wrong the moment the layout moved.
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={T.sheetAriaLabel}
        tabIndex={-1}
        className="symmetry-panel"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <header style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{T.sheetTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={T.closeAriaLabel}
            style={iconButtonStyle}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div role="tablist" aria-label={T.sheetTitle} style={tabListStyle}>
          <TabButton selected={tab === "chat"} onSelect={() => setTab("chat")} label={T.tabChat} />
          <TabButton
            selected={tab === "generate"}
            onSelect={() => setTab("generate")}
            label={T.tabGenerate}
          />
        </div>

        <div className="symmetry-body">
          {/*
            `key` on the tab rather than a conditional pair of branches: the two tabs are
            genuinely different screens with their own state, and letting one unmount as
            the other mounts is what keeps a half-finished wizard from appearing inside a
            conversation.
          */}
          {tab === "chat" ? (
            <ChatTab key="chat" userId={userId} initialContext={initialContext} onClose={onClose} />
          ) : (
            <div key="generate">
              <RoutineGeneratorWizard
                userId={userId ?? ""}
                catalog={catalog}
                exerciseNames={exerciseNames}
              />
            </div>
          )}
        </div>

        <footer style={footerStyle}>
          <p style={{ margin: 0, fontSize: 10, lineHeight: 1.4, color: TEXT.tertiary }}>
            {T.disclaimer}
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * The conversation tab.
 *
 * Loaded here rather than passed in, because the sheet is mounted in the app shell and
 * the context is derived from the athlete's records: threading it from `/coach` would
 * mean the assistant only worked on the screen that happened to have loaded it.
 */
function ChatTab({
  userId,
  initialContext,
  onClose,
}: {
  userId: string | null;
  initialContext: string | null;
  onClose: () => void;
}) {
  const { context, loading } = useCoachContext(userId);
  const gym = useGymSettings();

  if (userId === null || loading || !context) {
    /*
     * A status rather than a skeleton or a spinner: the conversation is not slow, it is
     * assembling a briefing from the athlete's records, and an empty panel with no
     * explanation reads as "the assistant has nothing to say".
     */
    return (
      <p role="status" style={{ margin: 0, fontSize: 12, color: TEXT.tertiary }}>
        {initialContext ?? T.disclaimer}
      </p>
    );
  }

  return (
    <>
      {initialContext !== null && (
        <p style={{ margin: `0 0 ${SPACE.sm}px`, fontSize: 11, color: TEXT.tertiary }}>
          {initialContext}
        </p>
      )}
      <CoachChat
        userId={userId}
        context={context}
        gymSettings={gym}
        fullScreen
        onClose={onClose}
      />
    </>
  );
}

function TabButton({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      style={{
        minHeight: MOTION.minTouchTarget,
        padding: "0 14px",
        borderRadius: RADIUS.pill,
        border: `1px solid ${selected ? ACCENT.border : "transparent"}`,
        backgroundColor: selected ? `${ACCENT.base}1f` : "transparent",
        color: selected ? ACCENT.text : TEXT.secondary,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.md,
  padding: `${SPACE.md}px ${SPACE.lg}px ${SPACE.sm}px`,
  // A grab bar, and also the swipe handle. It is not a draggable affordance on its own --
  // the whole panel responds -- but a thumb expects to grab something.
  borderBottom: `1px solid ${TEXT.tertiary}1f`,
};

const tabListStyle: CSSProperties = {
  display: "flex",
  gap: SPACE.sm,
  padding: `${SPACE.sm}px ${SPACE.lg}px`,
};

const footerStyle: CSSProperties = {
  padding: `${SPACE.sm}px ${SPACE.lg}px ${SPACE.md}px`,
  borderTop: `1px solid ${TEXT.tertiary}1f`,
};

const iconButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: MOTION.minTouchTarget,
  height: MOTION.minTouchTarget,
  flexShrink: 0,
  borderRadius: RADIUS.control,
  border: "1px solid transparent",
  backgroundColor: "transparent",
  color: TEXT.secondary,
  cursor: "pointer",
};