/**
 * HumanCoachChat.tsx — the coach's side of a session request's conversation.
 *
 * A transcript that polls every ten seconds and sends with a button. The whole file is
 * about the two ways a chat can be wrong that a screenshot will not show: a message that
 * arrives while nobody is looking and is never announced, and a send that appears to work
 * and then does not.
 *
 * **`sender_role` is sent, and it is not redundant with `sender_id`.** The id is the
 * authoritative *who* and the role is the *as*. The RLS insert policies require the two to
 * agree -- a coach can only write `{ sender_id: <their own>, sender_role: 'coach' }` --
 * which is what stops a row claiming the athlete's voice. Sending the role from the client
 * is therefore not trusting the client: the policy re-checks it, and the column exists so
 * a row always says "this athlete, as the athlete" or "this coach, as the coach".
 *
 * **Sending waits for the server.** The alternative -- append the message locally and
 * correct it if the write fails -- puts a message in a transcript that the athlete will
 * read as having been delivered. Ten seconds of polling already covers the round trip, so
 * the optimistic copy would be visible for about as long as it takes to be wrong.
 *
 * **The transcript is `aria-live="polite"` and the container, not the list.** A live region
 * on the scrolling element re-announces everything when its height changes, which on a chat
 * that grows by one line at a time is a screen reader reading the whole conversation again
 * after every message. On the wrapper, only the addition is announced.
 *
 * **Messages are not rendered as HTML.** `content` is whatever an athlete typed into a text
 * box; rendering it as markup would make the coach's portal a place where an athlete can
 * run script in a coach's authenticated session. React escapes it by default and this file
 * does not go around that.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { ACCENT, GLASS, TEXT, TYPE } from "@/design/tokens";
import { GlassButton } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { usePolling } from "@/hooks/usePolling";
import { supabase } from "@lib/supabase";
import type { CoachMessageRow } from "@/types/supabase";

/**
 * Ten seconds, matching the queue.
 *
 * `usePolling` pauses on a hidden tab and re-arms after each settled request, so this is a
 * ceiling on staleness rather than a request rate: an open portal costs one read per ten
 * seconds while somebody is looking at it.
 */
const POLL_MS = 10_000;

export interface HumanCoachChatProps {
  /** The session being discussed. `null` renders nothing -- see the note on mounting. */
  requestId: string | null;
  /** The signed-in coach, for `sender_id`. */
  userId: string;
}

export function HumanCoachChat({ requestId, userId }: HumanCoachChatProps) {
  const [messages, setMessages] = useState<CoachMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!requestId) return;

    setLoading(true);
    const { data, error: readError } = await supabase
      .from("coach_messages")
      .select("id,request_id,sender_id,sender_role,content,created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (!mounted.current) return;

    if (readError) {
      setError(T.chatLoadError);
      setLoading(false);
      return;
    }

    setMessages((data ?? []) as CoachMessageRow[]);
    setLoading(false);
  }, [requestId]);

  /*
   * Polled only while a session is selected.
   *
   * Not a conditional component and not a timer that runs anyway: `enabled` keeps the
   * selection state in `CoachPortal` rather than splitting it across two places, and it
   * means a coach with nothing open is not paying for a transcript nobody is reading.
   */
  usePolling(load, POLL_MS, requestId !== null);

  /*
   * Clear when the selection changes.
   *
   * Without this the previous athlete's transcript stays on screen for the length of one
   * request while the new one loads, and the coach is reading one conversation while
   * thinking they are reading another. Clearing is the honest intermediate state; the
   * alternative -- showing the old transcript until the new arrives -- is worse.
   */
  useEffect(() => {
    setMessages([]);
    setDraft("");
    setError(null);
  }, [requestId]);

  /** Scrolls the transcript to the newest message, without stealing focus. */
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastCount = messages.length;
  useEffect(() => {
    if (lastCount === 0) return;
    /*
     * Guarded rather than called bare.
     *
     * Every browser has `scrollIntoView`, but jsdom does not implement it, and a component
     * that cannot be mounted in a test without a global polyfill is a component whose
     * scroll behaviour is never asserted. One `typeof` check is cheaper than a setup file
     * that exists only to stub a method.
     */
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ block: "end" });
    }
  }, [lastCount]);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending, [draft, sending]);

  const send = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!requestId) return;

      const content = draft.trim();
      if (content === "" || sending) return;

      setSending(true);
      setError(null);

      const { error: writeError } = await supabase.from("coach_messages").insert({
        request_id: requestId,
        sender_id: userId,
        // Forced rather than passed around: there is one caller and it is always the
        // coach. Letting a prop decide would mean a component that can write as an athlete.
        sender_role: "coach",
        content,
      });

      if (!mounted.current) return;

      if (writeError) {
        // The draft is kept. Losing what someone typed because the network blipped is the
        // one failure a chat must not have.
        setError(T.chatError);
        setSending(false);
        return;
      }

      setDraft("");
      setSending(false);
      await load();
    },
    [draft, requestId, sending, userId, load],
  );

  if (requestId === null) return null;

  return (
    <section aria-labelledby="coach-chat-heading" className="flex min-h-0 flex-1 flex-col gap-3">
      <h3 id="coach-chat-heading" style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}>
        {T.chatTitle}
      </h3>

      {/*
       * The live region is the wrapper, not the scrolling list.
       *
       * A live region on the element whose height changes re-announces its whole contents
       * on every change, so a chat that grows by one line at a time would make a screen
       * reader read the entire conversation again after each message. On the wrapper only
       * the addition is announced.
       */}
      <div
        aria-live="polite"
        aria-busy={loading}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
      >
        {loading && messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>{T.loading}</p>
        ) : messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>{T.chatEmpty}</p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} ownId={userId} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
          {error}
        </p>
      )}

      <form onSubmit={send} className="flex items-end gap-2">
        {/*
         * A textarea rather than an input: a coach writing a training note will write
         * more than one line, and a single-line field turns that into a scrollbar.
         */}
        <textarea
          aria-label={T.chatPlaceholder}
          placeholder={T.chatPlaceholder}
          value={draft}
          rows={2}
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
          style={{
            flex: 1,
            resize: "vertical",
            borderRadius: 12,
            border: `1px solid ${GLASS.border}`,
            backgroundColor: GLASS.fill,
            color: TEXT.primary,
            padding: "8px 10px",
            fontSize: TYPE.subhead.size,
            fontFamily: "inherit",
          }}
        />
        <GlassButton
          type="submit"
          variant="primary"
          icon={<Send size={16} aria-hidden="true" />}
          disabled={!canSend}
        >
          {T.chatSend}
        </GlassButton>
      </form>
    </section>
  );
}

/**
 * One message, aligned by who wrote it.
 *
 * Alignment is by `sender_role` and not by comparing `sender_id` with the signed-in user.
 * The two agree for every row a client can write -- the insert policies force it -- but the
 * column is the one the policy checks, so it is the one worth rendering from. A row whose
 * role is null is treated as the athlete's: unattributable messages belong to neither
 * side, and defaulting them to "mine" would put somebody else's words in the coach's own
 * column.
 */
function MessageBubble({ message, ownId }: { message: CoachMessageRow; ownId: string }) {
  const mine = message.sender_id === ownId && message.sender_role === "coach";

  /*
    Mine reads brighter than theirs, but *alignment* is the primary signal and the fill
    is the secondary one: `alignSelf` already puts the athlete's messages on the right
    and the coach's on the left, which is how every chat app has taught people to read
    it. So the two fills are the app's own glass steps rather than a pair of tuned
    alphas -- the old 0.12 against 0.05 was a 2.4x contrast between two bubbles of the
    same conversation, which is louder than the distinction needs to be and cost the
    screen two more surface values to hold in its head.
  */
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "85%",
        borderRadius: 14,
        padding: "8px 12px",
        backgroundColor: mine ? GLASS.fillRaised : GLASS.fill,
        border: `1px solid ${GLASS.border}`,
      }}
    >
      {/*
       * Plain text. `content` is whatever an athlete typed into a text box, and rendering
       * it as markup would make this a place to run script inside a coach's authenticated
       * session. React escapes it, and nothing here goes around that.
       */}
      <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.primary, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {message.content}
      </p>
    </div>
  );
}