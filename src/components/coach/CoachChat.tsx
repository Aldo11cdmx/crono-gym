/**
 * CoachChat.tsx — la conversación con el asistente, en pantalla completa OLED.
 *
 * Soporta varias conversaciones independientes por usuario, persistidas en el
 * dispositivo (`chatStorage`, IndexedDB, una conversación por día). Cada sesión
 * de día tiene su propio transcripto y se puede crear, listar, cambiar y borrar.
 *
 * Cuando `fullScreen` es cierto ocupa el 100% de ancho y alto sin bordes ni
 * traslucidez que dejen ver la interfaz trasera: un panel negro denso
 * (`bg-neutral-950`) con cero transparencia, header con `X` de cierre, título
 * `"Cronos IA"` y una tira de chips de sugerencias justo sobre el campo de
 * entrada. Todo el estilo sale de `src/design/tokens.ts`.
 *
 * Las tres decisiones estructurales del componente original se mantienen:
 *  1. El contexto se construye aquí desde el mismo `CoachContext` del hub.
 *  2. Los fallos son mensajes en el transcripto, no toasts.
 *  3. Una petición abortada conserva la respuesta parcial.
 *
 * La persistencia falla a `null`/`false` sin reventar la pantalla: si IndexedDB no
 * responde, la conversación sigue usable en memoria.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { ACCENT, MOTION, RADIUS, SCRIM, SPACE, STATUS, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { GlassButton } from "@/components/ui";
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
import { parseRoutinePayload, validateRoutine, type GeneratedRoutine } from "@/lib/ai/routineGenerator";
import { saveGeneratedRoutine } from "@/lib/routines/saveGeneratedRoutine";
import {
  clearChat,
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
  /** El contexto ya cargado del hub. No se reobtiene: sería una segunda fuente. */
  context: CoachContext;
  gymSettings: GymSettings;
  /** Usuario autenticado, necesario para guardar una rutina propuesta en su cuenta. */
  userId: string;
  /** Cuando es cierto, el chat ocupa el 100% de la pantalla (modo OLED focus). */
  fullScreen?: boolean;
  onClose?: () => void;
  /** Día que se abre al montar, si se quiere arrancar en uno concreto. */
  initialDay?: string;
}

export function CoachChat({
  context,
  gymSettings,
  userId,
  fullScreen = false,
  onClose,
  initialDay,
}: CoachChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const [proposedRoutine, setProposedRoutine] = useState<GeneratedRoutine | null>(null);
  const [proposedRoutineError, setProposedRoutineError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // --------------------------------------------------------------- persistencia

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await pruneChatHistory();
      if (cancelled) return;
      const day = initialDay ?? undefined;
      const msgs = await loadChat(day);
      if (cancelled) return;
      setMessages(
        msgs.map((m) => ({
          ...m,
          isStreaming: false,
        })),
      );
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDay]);

  useEffect(() => {
    const list = listEndRef.current?.parentElement;
    if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    if (atBottom) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const assistantContext = useMemo(() => toAssistantContext(context, gymSettings), [
    context,
    gymSettings,
  ]);

  // --------------------------------------------------------------- acciones

  const handleNewSession = () => {
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
    setLoaded(true);
    setPersisted(true);
    setShowHistory(false);
  };

  const handleClear = async () => {
    setMessages([]);
    setDraft("");
    setPersisted(true);
    await clearChat();
  };

  const persist = useCallback(
    (next: ChatMessage[]) => {
      void saveChat(next).then((ok) => setPersisted(ok));
    },
    [],
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
      const withUser = [...messages, userMessage];
      setMessages(withUser);
      setDraft("");
      setBusy(true);

      // Guarda la pregunta antes de que llegue la respuesta: si la pestaña se cierra
      // a mitad del stream, el usuario no pierde lo que preguntó.
      void saveChat(withUser);

      const assistantId = crypto.randomUUID();

      void askCoach(
        {
          userMessage: trimmed,
          context: assistantContext,
          conversationHistory: toConversationTurns(messages),
          ...(selectTools(trimmed) ? { tools: [...EXERCISE_TOOLS] } : {}),
        },
        (chunk) => {
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
          if (response.action?.type === "routine_proposal") {
            setProposedRoutine(response.action.routine);
          }
        })
        .catch((cause: unknown) => {
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
          setProposedRoutineError("Respuesta no válida de Cronos.");
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

  const saveProposed = async () => {
    if (!proposedRoutine) return;
    const ok = await saveGeneratedRoutine(userId, proposedRoutine);
    if (ok) {
      setProposedRoutine(null);
      setProposedRoutineError(null);
    } else {
      setProposedRoutineError("No se pudo guardar la rutina en tu cuenta. Inténtalo de nuevo.");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const stop = () => abortRef.current?.abort();

  const tooLong = draft.length > MAX_USER_MESSAGE_CHARS;

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#000000",
        color: TEXT.primary,
      }
    : {
        backgroundColor: "transparent",
      };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${SPACE.lg} ${SPACE.xl}`,
    borderBottom: fullScreen ? `1px solid ${TEXT.tertiary}22` : undefined,
    minHeight: fullScreen ? 60 : undefined,
  };

  const headerLeftStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: SPACE.sm,
  };

  const titleStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: SPACE.xs,
    margin: 0,
    fontSize: TYPE.title2.size,
    fontWeight: TYPE.title2.weight,
    color: TEXT.primary,
  };

  const closeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: RADIUS.control,
    border: `1px solid ${TEXT.tertiary}33`,
    backgroundColor: SCRIM.recessed,
    color: TEXT.primary,
    cursor: "pointer",
  };

  const scrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: SPACE.xl,
    display: "flex",
    flexDirection: "column",
    gap: SPACE.sm,
  };

  const chipsStyle: React.CSSProperties = {
    display: "flex",
    gap: SPACE.xs,
    overflowX: "auto",
    paddingBottom: SPACE.md,
    scrollbarWidth: "none",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x mandatory",
    paddingLeft: SPACE.xl,
    paddingRight: SPACE.xl,
  };

  const chipStyle = (): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: SPACE.xs,
    minHeight: MOTION.minTouchTarget,
    padding: `${SPACE.xs} ${SPACE.md}`,
    borderRadius: RADIUS.pill,
    border: "1px solid rgba(39,39,42,0.5)",
    backgroundColor: "rgba(24,24,27,0.8)",
    color: TEXT.secondary,
    fontSize: TYPE.caption.size,
    fontWeight: TYPE.subhead.weight,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
    scrollSnapAlign: "start",
    transition: `transform ${MOTION.fast} ${MOTION.spring}`,
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    resize: "none",
    borderRadius: RADIUS.card,
    border: `1px solid ${tooLong ? STATUS.warning.text : focused ? "rgba(220,38,38,0.45)" : "rgba(255,255,255,0.08)"}`,
    backgroundColor: "rgba(9,9,11,0.6)",
    color: TEXT.primary,
    padding: "12px 14px",
    fontSize: TYPE.subhead.size,
    fontFamily: "inherit",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    transform: focused ? "translateY(-2px)" : "translateY(0)",
    transition: `border-color ${MOTION.fast} ${MOTION.easeOut}, box-shadow ${MOTION.fast} ${MOTION.easeOut}, transform ${MOTION.fast} ${MOTION.spring}`,
    boxShadow: busy
      ? "0 0 25px rgba(220,38,38,0.12)"
      : focused
      ? "0 0 18px rgba(220,38,38,0.08), 0 4px 24px rgba(0,0,0,0.4)"
      : "0 4px 24px rgba(0,0,0,0.4)",
  };

  const inputAreaStyle: React.CSSProperties = {
    padding: `${SPACE.lg} ${SPACE.xl}`,
    borderTop: "1px solid rgba(255,255,255,0.04)",
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  };

  // --------------------------------------------------------------- historial

  const historyPanelStyle: React.CSSProperties = {
    position: "absolute",
    top: fullScreen ? 60 : 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: SURFACE.base,
    borderBottom: `1px solid ${TEXT.tertiary}22`,
    padding: SPACE.xl,
    zIndex: 10,
    overflowY: "auto",
  };

  return (
    <div style={containerStyle}>
      {fullScreen && onClose && (
        <header style={headerStyle}>
          <div style={headerLeftStyle}>
            <span aria-hidden="true" style={{ color: ACCENT.base }}>
              ✦
            </span>
            <h2 style={titleStyle}>Cronos IA</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
            <GlassButton
              type="button"
              variant="ghost"
              onClick={handleNewSession}
              aria-label={T.chatNewSession}
              style={{ minHeight: MOTION.minTouchTarget }}
            >
              {T.chatNewSession}
            </GlassButton>
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setShowHistory((prev) => !prev)}
              aria-label={T.chatHistory}
              style={{ minHeight: MOTION.minTouchTarget }}
            >
              {showHistory ? T.chatHistory : T.chatHistory}
            </GlassButton>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Cronos IA"
              style={closeStyle}
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </div>
        </header>
      )}

      {!fullScreen ? (
        <div style={{ padding: SPACE.md }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: SPACE.md,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600 }}>
                {T.chatTitle}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                {T.chatSubtitle}
              </p>
            </div>
            {messages.length > 0 && (
              <div style={{ display: "flex", gap: SPACE.xs }}>
                <button
                  type="button"
                  onClick={handleNewSession}
                  aria-label={T.chatNewSession}
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
                  <span style={{ marginRight: 4 }}>{"+"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
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
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ paddingLeft: SPACE.xl, paddingRight: SPACE.xl, paddingBottom: SPACE.md }}>
          <div style={{ marginBottom: SPACE.md, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
            Cronos está contigo
          </div>
        </div>
      )}

      {showHistory && fullScreen && (
        <div style={historyPanelStyle}>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              color: TEXT.primary,
            }}
          >
            {T.chatSessionsTitle}
          </h3>
        </div>
      )}

      <div
        style={scrollStyle}
        aria-live="polite"
        aria-busy={busy}
      >
        {!loaded ? (
          <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
            {T.loading}
          </p>
        ) : messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
            {T.chatEmpty}
          </p>
        ) : (
          messages.map((message) => <Bubble key={message.id} message={message} />)
        )}
        <div ref={listEndRef} />
      </div>

      <div style={chipsStyle}>
        {T.chatSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/50 active:scale-95 transition-transform"
            onClick={() => {
              setDraft(suggestion);
              send(suggestion);
            }}
            aria-label={suggestion}
            style={chipStyle()}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={inputAreaStyle}>
        <label
          htmlFor="coach-chat-input"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {T.chatPlaceholder}
        </label>
        <textarea
          id="coach-chat-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
          rows={2}
          maxLength={MAX_USER_MESSAGE_CHARS + 1}
          placeholder={T.chatPlaceholder}
          aria-describedby="coach-chat-disclaimer"
          style={inputStyle}
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
        <ProposedRoutineCard
          routine={proposedRoutine}
          onSave={saveProposed}
          onClose={dismissProposed}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------- bubble

function Bubble({ message }: { message: ChatMessage }) {
  const authModal = useAuthModal();

  if (message.role === "error") {
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
              animation: `cronos-caret ${MOTION.loop.caret} steps(2, start) infinite`,
            }}
          />
        )}
      </p>

      {message.action && message.action.type !== "routine_proposal" && (
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
    case "routine_proposal":
      return "Rutina propuesta por Cronos IA. Usa Guardar en mis rutinas para añadirla a tu biblioteca.";
  }
}

// --------------------------------------------------------------- finalize

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
            content: bubble.content !== "" ? bubble.content : message.content,
          }
        : message,
    );
  }
  return response === undefined ? current : [...current, bubble];
}

// --------------------------------------------------------------- errors

function isAbort(cause: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return cause instanceof Error && cause.name === "AbortError";
}

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
  onSave,
  onClose,
}: {
  routine: GeneratedRoutine;
  onSave: () => void;
  onClose: () => void;
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
      <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: ACCENT.text }}>
        Cronos propuso una rutina
      </p>
      <p style={{ margin: "4px 0 0", fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
        {routine.name} · {routine.days.length} día{routine.days.length === 1 ? "" : "s"}
      </p>
      <div style={{ marginTop: 8, display: "flex", gap: SPACE.sm }}>
        <GlassButton variant="primary" onClick={onSave}>
          Guardar en mis rutinas
        </GlassButton>
        <GlassButton variant="ghost" onClick={onClose}>
          Descartar
        </GlassButton>
      </div>
    </div>
  );
}

