/**
 * CoachChat.tsx — the conversation with the assistant.
 *
 * Three decisions shape this component, and each of them has a failure it is avoiding:
 *
 *  1. **The context is built here, from the same `CoachContext` the hub shows.** The
 *     model is told the same numbers the athlete is looking at, on purpose. A second
 *     projection would be a second place for the app to decide what it knows, and the
 *     two would drift.
 *
 *  2. **Failures are messages in the transcript, not toasts.** A rate-limit notice that
 *     disappears after four seconds is not something an athlete can act on. Putting it
 *     in the scroll keeps the history of what the coach could and could not answer
 *     readable next to what it did. This is why `ChatMessage` carries
 *     `role: "error"`.
 *
 *  3. **An aborted request keeps the partial answer.** Stopping a stream that has
 *     already produced two sentences and throwing them away would punish the athlete
 *     for a change of mind; the text is still true.
 *
 * The transcript is saved to IndexedDB after every turn, not on unload. An unload
 * handler does not fire when the tab is killed, and mobile browsers kill tabs
 * constantly -- so the common case would be no save at all.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AlertTriangle, Send, Square, Trash2 } from "lucide-react";
import { ACCENT, MOTION, RADIUS, SCRIM, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard } from "@/components/ui";
import { COACH_LABELS as T } from "@/lib/i18n";
import { useAuthModal } from "@/context/AuthModalContext";
import type { GymSettings } from "@/context/GymSettingsContext";
import type { CoachContext } from "@/lib/coach/types";
import {
  MAX_USER_MESSAGE_CHARS,
  askCoach,
  type AssistantResponse,
  type ToolCall,
} from "@/lib/ai/coachAssistant";
import { toAssistantContext, type CoachError, type ChatMessage } from "@/lib/ai/types";
import { EXERCISE_TOOLS } from "@/lib/ai/tools";
import { parseRoutinePayload, validateRoutine } from "@/lib/ai/routineGenerator";
import type { GeneratedRoutine } from "@/lib/ai/routineGenerator";
import {
  chatDay,
  loadChat,
  pruneChatHistory,
  saveChat,
  toConversationTurns,
} from "@/lib/ai/chatStorage";

const EXERCISE_KEYWORDS = [
  "rutina",
  "ejercicio",
  "ejercicios",
  "pr",
  "récord",
  "1rm",
  "repeticiones",
  "reps",
  "peso",
  "libre",
  "máquina",
  "máquinas",
  "gimnasio",
  "equipo",
  "sentadilla",
  "press",
  "curl",
  "remo",
  "peso muerto",
  "carga",
  "serie",
  "series",
  "descanso",
  "calentamiento",
];

function selectTools(text: string): boolean {
  const lower = text.toLowerCase();
  return EXERCISE_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface CoachChatProps {
  /** The hub's already-loaded context. Not re-fetched: it would be a second source. */
  context: CoachContext;
  gymSettings: GymSettings;
}

export function CoachChat({ context, gymSettings }: CoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const [proposedRoutine, setProposedRoutine] = useState<GeneratedRoutine | null>(null);
  const [proposedRoutineError, setProposedRoutineError] = useState<string | null>(null);

  const day = useMemo(() => chatDay(), []);

  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Load today's conversation on mount. Also prunes: retention enforced on load is the
  // only way it ever gets enforced for someone who stopped chatting.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [stored] = await Promise.all([loadChat(day), pruneChatHistory(day)]);
      if (cancelled) return;
      setMessages(stored);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  // Follow the stream. Scrolling only when the athlete is already at the bottom, so
  // reading back through the conversation is not yanked away by every new token.
  useEffect(() => {
    const list = listEndRef.current?.parentElement;
    if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    if (atBottom) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const assistantContext = useMemo(
    () => toAssistantContext(context, gymSettings),
    [context, gymSettings],
  );

  const persist = useCallback(
    (next: ChatMessage[]) => {
      void saveChat(next, day).then(setPersisted);
    },
    [day],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "" || busy) return;

      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      // Saved before the request, not after: if the tab dies mid-stream the question
      // the athlete typed is the part they will want to find again.
      const withUser = [...messages, userMessage];
      setMessages(withUser);
      setDraft("");
      setBusy(true);
      persist(withUser);

      const assistantId = crypto.randomUUID();

      void askCoach(
        {
          userMessage: trimmed,
          context: assistantContext,
          conversationHistory: toConversationTurns(messages),
          ...(selectTools(trimmed) ? { tools: [...EXERCISE_TOOLS] } : {}),
        },
        (chunk) => {
          // One functional update per chunk rather than a captured `messages`: the
          // stream is the one thing in this component that can fire many times before
          // React settles, and a stale closure would drop fragments.
          setMessages((current) => {
            const existing = current.find((m) => m.id === assistantId);
            if (existing) {
              return current.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + chunk } : m,
              );
            }
            return [
              ...current,
              {
                id: assistantId,
                role: "assistant",
                content: chunk,
                timestamp: Date.now(),
                isStreaming: true,
              },
            ];
          });
        },
        controller.signal,
      )
        .then((response) => {
          if (response.toolCalls && response.toolCalls.length > 0) {
            handleToolCalls(response.toolCalls);
          }
          setMessages((current) => {
            const next = finalize(current, assistantId, response);
            persist(next);
            return next;
          });
        })
        .catch((cause: unknown) => {
          // An abort is the athlete's own doing, not a failure worth a bubble. The
          // partial text stays: it was already true when they stopped reading it.
          if (isAbort(cause, controller.signal)) {
            setMessages((current) => {
              const next = finalize(current, assistantId);
              persist(next);
              return next;
            });
            return;
          }

          const error = classify(cause);
          setMessages((current) => {
            const next = [
              ...finalize(current, assistantId),
              {
                id: crypto.randomUUID(),
                role: "error" as const,
                content: T.chatErrors[error.code] ?? T.chatErrors.SERVICE_UNAVAILABLE,
                timestamp: Date.now(),
                // Carried so the bubble can offer re-authentication only when that is
                // the thing that would fix it.
                errorCode: error.code,
              },
            ];
            persist(next);
            return next;
          });
        })
        .finally(() => {
          abortRef.current = null;
          setBusy(false);
        });
      },
     [assistantContext, busy, messages, persist],
   );

  const handleToolCalls = (toolCalls: ToolCall[]) => {
    for (const tc of toolCalls) {
      if (tc.function.name === "createRoutine") {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          setProposedRoutineError("Respuesta no válida de Symmetry.");
          return;
        }
        const parsed = parseRoutinePayload(JSON.stringify(args));
        const routine = validateRoutine(parsed);
        if (routine) {
          setProposedRoutine(routine);
        } else {
          setProposedRoutineError("La rutina propuesta no tiene el formato esperado.");
        }
      }
    }
  };

  const dismissProposed = () => {
    setProposedRoutine(null);
    setProposedRoutineError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const stop = () => abortRef.current?.abort();

  const clearToday = () => {
    abortRef.current?.abort();
    setMessages([]);
    persist([]);
  };

  const tooLong = draft.length > MAX_USER_MESSAGE_CHARS;

  return (
    <GlassCard>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: SPACE.md,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}>{T.chatTitle}</h3>
          <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
            {T.chatSubtitle}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearToday}
            aria-label={T.chatClear}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: MOTION.minTouchTarget,
              height: MOTION.minTouchTarget,
              flexShrink: 0,
              borderRadius: RADIUS.control,
              border: "1px solid transparent",
              backgroundColor: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 
          `aria-live="polite"` on the transcript rather than `assertive`: a stream emits
          dozens of updates, and an assertive region would announce every one of them.
      */}
      <div
        aria-live="polite"
        aria-busy={busy}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.sm,
          marginTop: SPACE.md,
          maxHeight: 320,
          overflowY: "auto",
          // Reduced motion removes the caret pulse below, but the transition here is on
          // layout, so it is left alone: it only runs when content is actually added.
        }}
      >
        {!loaded ? (
          <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>{T.loading}</p>
        ) : messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>{T.chatEmpty}</p>
        ) : (
          messages.map((message) => <Bubble key={message.id} message={message} />)
        )}
        <div ref={listEndRef} />
      </div>

      <form onSubmit={submit} style={{ marginTop: SPACE.md }}>
        <label
          htmlFor="coach-chat-input"
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: TYPE.label.size,
            textTransform: "uppercase",
            letterSpacing: TYPE.label.tracking,
            color: tooLong ? STATUS.warning.text : TEXT.tertiary,
          }}
        >
          {T.chatPlaceholder}
        </label>
        <textarea
          id="coach-chat-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line. A send key that also inserts a
            // newline is the one thing that makes a chat box feel broken on desktop.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
          rows={2}
          maxLength={MAX_USER_MESSAGE_CHARS + 1}
          placeholder={T.chatPlaceholder}
          aria-describedby="coach-chat-disclaimer"
          style={{
            width: "100%",
            resize: "vertical",
            borderRadius: RADIUS.control,
            border: `1px solid ${tooLong ? STATUS.warning.text : `${TEXT.tertiary}33`}`,
            backgroundColor: SCRIM.recessed,
            color: TEXT.primary,
            padding: "10px 12px",
            fontSize: TYPE.subhead.size,
            fontFamily: "inherit",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.sm,
            marginTop: SPACE.sm,
          }}
        >
          <span style={{ fontSize: TYPE.label.size, color: TEXT.tertiary }}>
            {tooLong
              ? `${draft.length} / ${MAX_USER_MESSAGE_CHARS}`
              : !persisted && T.chatNotSaved}
          </span>

          {busy ? (
            <GlassButton type="button" variant="ghost" onClick={stop}>
              <Square size={13} aria-hidden="true" />
              {T.chatStop}
            </GlassButton>
          ) : (
            <GlassButton
              type="submit"
              variant="primary"
              disabled={draft.trim() === "" || tooLong}
              style={{ opacity: draft.trim() === "" || tooLong ? 0.5 : 1 }}
            >
              <Send size={13} aria-hidden="true" />
              {T.chatSend}
            </GlassButton>
          )}
        </div>
      </form>

      <p
        id="coach-chat-disclaimer"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          margin: `${SPACE.md}px 0 0`,
          fontSize: TYPE.label.size,
          lineHeight: 1.5,
          color: TEXT.tertiary,
        }}
      >
        <AlertTriangle size={13} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        {T.chatDisclaimer}
      </p>

      {proposedRoutineError && (
        <div
          role="alert"
          style={{
            marginTop: SPACE.md,
            padding: "9px 12px",
            borderRadius: RADIUS.control,
            border: `1px solid #f871712e`,
            backgroundColor: "#f8717112",
            fontSize: TYPE.caption.size,
            color: TEXT.primary,
          }}
        >
          {proposedRoutineError}
          <button
            type="button"
            onClick={dismissProposed}
            style={{
              marginLeft: 8,
              border: "none",
              background: "transparent",
              color: ACCENT.text,
              fontSize: TYPE.caption.size,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      {proposedRoutine && (
        <ProposedRoutineCard routine={proposedRoutine} onAccept={dismissProposed} />
      )}
    </GlassCard>
  );
}

// --------------------------------------------------------------- bubble

function Bubble({ message }: { message: ChatMessage }) {
  const authModal = useAuthModal();

  if (message.role === "error") {
    // Only an expired session gets a way out. A rate limit has nothing the athlete
    // can do, and offering "sign in again" there would be a button that cannot help.
    const recoverable = message.errorCode === "AUTH_ERROR";
    return (
      <div
        role="alert"
        style={{
          alignSelf: "stretch",
          borderRadius: RADIUS.control,
          border: `1px solid #f871712e`,
          backgroundColor: "#f8717112",
          padding: "9px 12px",
          fontSize: TYPE.caption.size,
          color: TEXT.primary,
        }}
      >
        <p style={{ margin: 0 }}>{message.content}</p>
        {recoverable && (
          <div style={{ marginTop: 8 }}>
            <GlassButton type="button" variant="primary" onClick={authModal.open}>
              {T.chatSignInAgain}
            </GlassButton>
          </div>
        )}
      </div>
    );
  }

  const mine = message.role === "user";

  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "85%",
        borderRadius: RADIUS.control,
        // Asymmetric so the two speakers are distinguishable by shape as well as by
        // side: colour alone would fail anyone who cannot separate them.
        borderBottomLeftRadius: mine ? RADIUS.control : 2,
        borderBottomRightRadius: mine ? 2 : RADIUS.control,
        border: `1px solid ${mine ? `${ACCENT.base}44` : `${TEXT.tertiary}22`}`,
        backgroundColor: mine ? `${ACCENT.base}14` : SCRIM.recessed,
        padding: "9px 12px",
      }}
    >
      <p style={{ margin: 0, fontSize: TYPE.subhead.size, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {message.content}
        {message.isStreaming && (
          <span
            aria-hidden="true"
            className="cronos-chat--caret"
            style={{
              display: "inline-block",
              width: 6,
              height: 13,
              marginLeft: 2,
              verticalAlign: "-2px",
              backgroundColor: ACCENT.text,
              // The one animation here worth having: it is the only signal that the
              // answer is still arriving. The keyframes and the reduced-motion
              // override live in index.css with the app's other motion.
              //
              // `steps(2, start)` is deliberately not one of `MOTION`'s curves. A caret
              // has to snap on and off; easing it would make it fade at the edges, and a
              // cursor that fades is not a cursor. The period is the token because a
              // duration is a decision, and the timing function is not because this is the
              // one thing on screen that should not move smoothly.
              animation: `cronos-caret ${MOTION.loop.caret} steps(2, start) infinite`,
            }}
          />
        )}
      </p>

      {message.action && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${TEXT.tertiary}22`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: TYPE.label.size,
              textTransform: "uppercase",
              letterSpacing: TYPE.label.tracking,
              color: ACCENT.text,
            }}
          >
            {T.chatActions[message.action.type] ?? message.action.type}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.secondary }}>
            {describeAction(message.action)}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * A structured recommendation in words.
 *
 * Derived from the discriminant, never stored: the four kinds say genuinely different
 * things and a generic "aplicar" would leave the athlete unable to tell a load change
 * from a deload.
 */
function describeAction(action: NonNullable<ChatMessage["action"]>): string {
  switch (action.type) {
    case "exercise_swap":
      return `${action.fromExercise} → ${action.toExercise}. ${action.reason}`;
    case "training_adjustment":
      return `${action.field} ${action.delta > 0 ? "+" : ""}${action.delta}. ${action.reason}`;
    case "calorie_adjustment":
      return `${action.deltaKcal > 0 ? "+" : ""}${action.deltaKcal} kcal. ${action.reason}`;
    case "deload_suggestion":
      return `${action.durationWeeks} ${action.durationWeeks === 1 ? "semana" : "semanas"}. ${action.reason}`;
  }
}

// --------------------------------------------------------------- finalize

/**
 * Settles the placeholder bubble once the request ends.
 *
 * The bubble is normally created by the first `onChunk`, but not always: a provider
 * can return a complete answer having emitted no fragments at all, and an empty
 * `onChunk` sequence is legal. Mapping over `current` alone would then find nothing
 * to update and the answer would be dropped on the floor — the athlete's question
 * stays on screen with no reply and no error, which reads as a silent failure.
 * So the bubble is appended when it is missing.
 *
 * `response` is optional: on an abort there may be no result, and the bubble only has
 * to stop claiming to be streaming.
 */
function finalize(
  current: ChatMessage[],
  assistantId: string,
  response?: AssistantResponse,
): ChatMessage[] {
  const bubble: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: response?.message ?? "",
    timestamp: Date.now(),
    isStreaming: false,
    ...(response?.action ? { action: response.action } : {}),
  };

  if (current.some((message) => message.id === assistantId)) {
    return current.map((message) =>
      message.id === assistantId
        ? {
            ...bubble,
            /*
             * The server's text is the complete one with any action block stripped
             * out, so it replaces what accumulated — except when it is empty. A model
             * that emitted only an action fence leaves nothing behind, and replacing
             * unconditionally would erase prose that was already on screen.
             */
            content: bubble.content !== "" ? bubble.content : message.content,
          }
        : message,
    );
  }
  // Nothing was streamed. Keep the bubble only if there is something to show.
  return response === undefined ? current : [...current, bubble];
}

// --------------------------------------------------------------- errors

function isAbort(cause: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return cause instanceof Error && cause.name === "AbortError";
}

/**
 * Reduces anything thrown to a code the transcript has words for.
 *
 * `CoachRequestError` is the classified path. Anything else is a bug, and rendering it
 * as "unavailable" rather than as a stack trace keeps an internal failure out of a
 * user-facing surface without hiding it from the console.
 */
function classify(cause: unknown): CoachError {
  if (typeof cause === "object" && cause !== null && "detail" in cause) {
    const detail = (cause as { detail: unknown }).detail;
    if (typeof detail === "object" && detail !== null && "code" in detail) {
      return detail as CoachError;
    }
  }
  return { code: "SERVICE_UNAVAILABLE" };
}

// --------------------------------------------------------------- proposed

function ProposedRoutineCard({
  routine,
  onAccept,
}: {
  routine: GeneratedRoutine;
  onAccept: () => void;
}) {
  return (
    <div
      style={{
        marginTop: SPACE.md,
        padding: "9px 12px",
        borderRadius: RADIUS.control,
        border: `1px solid ${ACCENT.border}`,
        backgroundColor: `${ACCENT.base}14`,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: ACCENT.text }}>
        Symmetry propuso una rutina
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: TEXT.tertiary }}>
        {routine.name} · {routine.days.length} día{routine.days.length === 1 ? "" : "s"}
      </p>
      <div style={{ marginTop: 8, display: "flex", gap: SPACE.sm }}>
        <GlassButton variant="primary" onClick={onAccept}>
          Ver rutina
        </GlassButton>
        <GlassButton variant="ghost" onClick={onAccept}>
          Cerrar
        </GlassButton>
      </div>
    </div>
  );
}