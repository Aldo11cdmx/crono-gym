/**
 * RequestQueue.tsx — the coach's inbox: who asked for a session, and the two buttons.
 *
 * The first screen of the portal and the only one that is genuinely a queue. Everything
 * else in here is driven by a choice made on this list.
 *
 * **It reads `coach_session_requests` with no `coach_id` filter.** That looks like a leak
 * until you read the policy: `"coaches can read assigned requests"` already scopes the
 * result set to requests addressed to the calling coach, so adding
 * `.eq("coach_id", …)` would filter rows the database has already refused to return. It
 * would also cost a second round trip to learn the coach's own id first, and the one
 * thing a coach must never be able to influence here is *which* coach they are asking
 * about. The absence of the filter is the security property, not an oversight.
 *
 * **Which rows qualify for what is a second, client-side filter.** RLS answers "is this
 * request mine"; it cannot answer "should this one be in my inbox". Declined and closed
 * requests stay in the table forever and a coach does not want last month's declines
 * crowding the list. Pending is what needs a decision, active is what needs a
 * conversation, and the two are rendered as two groups rather than one sorted list so
 * neither can push the other out of view.
 *
 * **The names come from a second query.** `coach_session_requests` carries only
 * `athlete_id`, and PostgREST cannot embed `profiles` through `auth.users` from a browser
 * client. So the ids go into a second `profiles` read and the join happens in memory --
 * the same two-explicit-queries rule `AthleteCRM` uses for routine history. A list of uuids
 * would be technically correct and useless: a coach cannot tell two athletes apart by
 * which half of a uuid they recognise.
 *
 * Accepting and declining are optimistic, then re-read on failure. The write is one
 * `update` scoped by id, and the policy decides whether it lands -- so a stale queue is
 * corrected by the poll rather than by local bookkeeping that can disagree with it.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { ACCENT, TEXT, TYPE } from "@/design/tokens";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { COACH_PORTAL_LABELS as T } from "@/lib/i18n";
import { usePolling } from "@/hooks/usePolling";
import { supabase } from "@lib/supabase";
import type { CoachRequestRow, ProfileRow } from "@/types/supabase";

/**
 * How often the queue re-reads.
 *
 * Ten seconds, matching the chat. The number is a compromise: a coach waiting on an
 * accept to feel instant would poll faster, and a portal left open all day would then cost
 * a request every few seconds for nobody looking at it. `usePolling` handles the second
 * problem by pausing on a hidden tab, which is what makes a short interval affordable.
 */
const POLL_MS = 10_000;

/** A request as the queue needs it: the row, plus the name read in a second query. */
interface QueueRow {
  request: CoachRequestRow;
  displayName: string;
}

/** Which of the two buttons a row is currently running, so they cannot race one request. */
type DecisionKind = "accept" | "decline";
type PendingAction = { id: string; kind: DecisionKind } | null;

export interface RequestQueueProps {
  /**
   * Opens an athlete's conversation.
   *
   * Carries the athlete as well as the request, and that is not convenience. `CoachPortal`
   * hands the same selection to the CRM and the routine builder, whose reads are filtered by
   * `user_id` and rely on the coach SELECT policies to qualify them -- so a callback with
   * only the request id would leave the parent doing a second lookup to turn a conversation
   * into a person, and a lookup whose answer could disagree with the row that produced it.
   *
   * The queue does not render the chat: the parent owns the selection so the CRM beside it
   * follows the same athlete without a second piece of state.
   */
  onOpenConversation: (requestId: string, athleteId: string) => void;
}

export function RequestQueue({ onOpenConversation }: RequestQueueProps) {
  const [pending, setPending] = useState<QueueRow[]>([]);
  const [active, setActive] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState<PendingAction>(null);

  /**
   * Guards a state write after unmount.
   *
   * The poll is what makes this reachable in normal use: a request that takes longer than
   * the coach's patience to navigate away from resolves into a dead component otherwise.
   */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const { data, error: readError } = await supabase
      .from("coach_session_requests")
      .select("id,athlete_id,coach_id,status,athlete_notes,created_at,updated_at")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false });

    if (!mounted.current) return;

    if (readError) {
      setError(T.queueLoadError);
      setLoading(false);
      return;
    }

    const requests = (data ?? []) as CoachRequestRow[];
    if (requests.length === 0) {
      setPending([]);
      setActive([]);
      setLoading(false);
      return;
    }

    /*
     * Names in a second read, deduplicated.
     *
     * `new Set` because the same athlete can have more than one open request -- they
     * cannot ask twice while one is pending, but an active one and a pending one is
     * exactly the state `alreadyActive` warns about -- and a repeated uuid in `in.()`
     * is a longer URL for the same answer.
     *
     * A failed name read is not a queue failure. The rows are still valid and still
     * actionable; dropping the whole list because a label could not be fetched would
     * hide a request the coach is waiting on.
     */
    const athleteIds = [...new Set(requests.map((r) => r.athlete_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", athleteIds);

    if (!mounted.current) return;

    const names = new Map<string, string>();
    for (const profile of (profiles ?? []) as Pick<ProfileRow, "user_id" | "display_name">[]) {
      if (profile.display_name) names.set(profile.user_id, profile.display_name);
    }

    const rows: QueueRow[] = requests.map((request) => ({
      request,
      displayName: names.get(request.athlete_id) ?? T.athleteUnnamed,
    }));

    setPending(rows.filter((r) => r.request.status === "pending"));
    setActive(rows.filter((r) => r.request.status === "active"));
    setLoading(false);
  }, []);

  usePolling(load, POLL_MS);

  /**
   * Move a request to a new status.
   *
   * No optimistic removal, and that is a deliberate change from the obvious version. With
   * the row removed on tap, three things follow: the button that was pressed disappears,
   * so the only feedback available is the row vanishing into the other group; a refusal has
   * to be undone by snapshotting the previous lists and restoring them, which is the
   * fiddliest code in this file and exists only to correct the guess; and `accepting` /
   * `declining` become unreachable, because the card they live on is gone before they
   * could render.
   *
   * Writing first and re-reading instead means the row stays put saying `Aceptando…` until
   * the server agrees, the queue never asserts a decision that was refused, and every
   * string the file owns is reachable. The ten-second poll means a slow write is visible
   * for at most that long, which is a better trade than a queue that briefly lies.
   */
  const decide = useCallback(
    async (id: string, status: "active" | "declined", kind: DecisionKind) => {
      setWorking({ id, kind });
      setActionError(null);

      const { error: writeError } = await supabase
        .from("coach_session_requests")
        .update({ status })
        .eq("id", id);

      if (!mounted.current) return;

      setWorking(null);

      if (writeError) {
        setActionError(T.queueError);
        return;
      }

      // The write landed. Re-read rather than patching local state: the same read answers
      // any row that changed underneath us, and it is the one path that cannot drift.
      await load();
    },
    [load],
  );

  return (
    <section aria-labelledby="request-queue-heading" className="flex flex-col gap-3">
      <h3
        id="request-queue-heading"
        style={{ margin: 0, fontSize: TYPE.callout.size, fontWeight: 600, color: TEXT.primary }}
      >
        {T.queueTitle}
      </h3>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
          {error}
        </p>
      )}

      {actionError && (
        <p role="alert" style={{ margin: 0, fontSize: TYPE.subhead.size, color: ACCENT.text }}>
          {actionError}
        </p>
      )}

      {loading ? (
        <Skeleton />
      ) : pending.length === 0 && active.length === 0 ? (
        <GlassCard>
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
            {T.queueEmptyTitle}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: TYPE.subhead.size, color: TEXT.tertiary }}>
            {T.queueEmptyBody}
          </p>
        </GlassCard>
      ) : (
        <>
          {/*
           * Pending first and not sorted after active.
           *
           * A single newest-first list is the obvious design and it is wrong here: a run of
           * active sessions would push the one request that needs a decision off the bottom
           * of the panel, and the coach would not know it was there. The queue is ordered
           * by what is owed to the coach.
           */}
          {pending.length > 0 && (
            <ul className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {pending.map((row) => (
                <RequestCard
                  key={row.request.id}
                  row={row}
                  busyLabel={
                    working?.id === row.request.id
                      ? working.kind === "accept"
                        ? T.accepting
                        : T.declining
                      : null
                  }
                  actions={
                    <>
                      <GlassButton
                        variant="primary"
                        icon={<Check size={16} aria-hidden="true" />}
                        disabled={working !== null}
                        onClick={() => void decide(row.request.id, "active", "accept")}
                      >
                        {T.accept}
                      </GlassButton>
                      <GlassButton
                        variant="ghost"
                        icon={<X size={16} aria-hidden="true" />}
                        disabled={working !== null}
                        onClick={() => void decide(row.request.id, "declined", "decline")}
                      >
                        {T.decline}
                      </GlassButton>
                    </>
                  }
                />
              ))}
            </ul>
          )}

          {active.length > 0 && (
            <ul className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {active.map((row) => (
                <RequestCard
                  key={row.request.id}
                  row={row}
                  busyLabel={null}
                  actions={
                    <GlassButton
                      variant="secondary"
                      icon={<MessageSquare size={16} aria-hidden="true" />}
                      onClick={() => onOpenConversation(row.request.id, row.request.athlete_id)}
                    >
                      {T.openConversation}
                    </GlassButton>
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/**
 * One request: who, when, what they wrote, and whatever buttons apply to its status.
 *
 * The note is always rendered, including when it is null. An athlete who wrote nothing is
 * a real case and "no dejó ninguna nota" says so, where an empty box says nothing at all
 * and looks like a bug.
 */
function RequestCard({
  row,
  actions,
  busyLabel,
}: {
  row: QueueRow;
  actions: ReactNode;
  /** Non-null while one of this card's own buttons is mid-flight. */
  busyLabel: string | null;
}) {
  const { request } = row;

  return (
    <GlassCard>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
            {row.displayName}
          </p>
          <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
            {T.requestSentAt(formatWhen(request.created_at))}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {T.requestStatus[request.status] ?? request.status}
        </p>

        <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
          {request.athlete_notes?.trim() ? request.athlete_notes : T.requestNotesEmpty}
        </p>

        <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 4 }}>
          {actions}
          {busyLabel && (
            <span aria-live="polite" style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
              {busyLabel}
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * A timestamp as a short local date and time.
 *
 * Local, deliberately: "hace 2 días" and "en 3 días" are both wrong for a coach reading a
 * queue in their own timezone, and an ISO string next to a name is a worse answer than a
 * plain one. Falls back to the raw string when it will not parse rather than printing
 * "Invalid Date", which is what `toLocaleString` does with a bad input.
 */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}