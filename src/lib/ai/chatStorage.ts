/**
 * chatStorage.ts — the assistant's conversation log, on the athlete's own device.
 *
 * One conversation per calendar day, keyed by `YYYY-MM-DD`. Two reasons for the day
 * boundary rather than one running thread:
 *
 *  - A coach's advice is only true relative to the day it was given. Yesterday's
 *    "add a set" is not advice today, and mixing the two in a single scrollback
 *    invites an athlete to act on a recommendation whose premise has expired.
 *  - It bounds the data without needing a retention policy. A year of days is a year
 *    of rows; a year of turns would be unbounded and mostly unread.
 *
 * Everything here is local. Nothing in this module, and nothing the assistant says,
 * is sent to Supabase — `coach_usage` records a token count and the model id, and
 * deliberately no message content. So a conversation can be erased by clearing the
 * store and by nothing else, which is the point.
 *
 * Degradation matches `../idb`: a missing database, a failed request or an exhausted
 * quota all resolve to `null` or `false`. A chat that cannot be saved must still be
 * readable, because the alternative is losing an answer the athlete is looking at.
 */

import { COACH_CHATS_STORE, tx } from "../idb";
import type { ChatMessage } from "@/lib/ai/types";

/** One day's conversation. `id` is the ISO day, so re-saving replaces it. */
export interface CoachChatRecord {
  /** `YYYY-MM-DD`. The store's key path. */
  id: string;
  messages: ChatMessage[];
  updatedAt: string;
}

/** `YYYY-MM-DD` in UTC, so the day boundary does not depend on the device's clock. */
export function chatDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Days retained before {@link pruneChatHistory} will consider removing them.
 *
 * A month, not a year: the log exists to survive a reload and to let yesterday's
 * conversation carry over, and nobody reads a coaching transcript from eleven months
 * ago. A month of growth is still several hundred rows of possibly-sensitive text on
 * a shared device, so it is worth pruning rather than keeping forever.
 */
export const CHAT_RETENTION_DAYS = 30;

/** Loads one day's conversation. Missing day, missing database, or failure: empty. */
export async function loadChat(day: string = chatDay()): Promise<ChatMessage[]> {
  const row = await tx<CoachChatRecord>(COACH_CHATS_STORE, "readonly", (store) =>
    store.get(day),
  );
  return row?.messages ?? [];
}

/**
 * Replaces one day's conversation.
 *
 * `put`, not `append`: the caller owns the whole transcript, and appending would make
 * a re-save after a reload duplicate every turn in the day.
 *
 * Returns whether the write landed. A false here is not an error the UI should
 * surface -- the conversation is on screen either way -- but the caller can use it to
 * warn that a reload will lose the thread.
 */
export async function saveChat(
  messages: ChatMessage[],
  day: string = chatDay(),
  now: string = new Date().toISOString(),
): Promise<boolean> {
  const row: CoachChatRecord = { id: day, messages, updatedAt: now };
  const result = await tx(COACH_CHATS_STORE, "readwrite", (store) => store.put(row));
  // `put` returns the key path, so a truthy result means the request resolved.
  return result !== null;
}

/** Every retained day, newest first. Used by the history list, not the chat screen. */
export async function loadAllChats(): Promise<CoachChatRecord[]> {
  const rows = await tx<CoachChatRecord[]>(COACH_CHATS_STORE, "readonly", (store) =>
    store.getAll(),
  );
  return (rows ?? []).sort((a, b) => b.id.localeCompare(a.id));
}

/** Drops one day. Returns whether a row was actually removed. */
export async function clearChat(day: string = chatDay()): Promise<boolean> {
  const before = await loadChat(day);
  await tx(COACH_CHATS_STORE, "readwrite", (store) => store.delete(day));
  return before.length > 0;
}

/** Drops every conversation. Used on sign-out. */
export async function clearAllChats(): Promise<void> {
  await tx(COACH_CHATS_STORE, "readwrite", (store) => store.clear());
}

/**
 * Removes days older than {@link CHAT_RETENTION_DAYS}.
 *
 * Called on load rather than on write: pruning that only happens when someone
 * happens to chat does not prune a user who stopped, which is most of the value of
 * having a retention limit at all.
 *
 * Pruning on load costs one full read of the store. It is small — a month of days —
 * and the alternative is a cron the app has no way to schedule on a user's phone.
 */
export async function pruneChatHistory(
  today: string = chatDay(),
  retentionDays: number = CHAT_RETENTION_DAYS,
): Promise<number> {
  const rows = await tx<CoachChatRecord[]>(COACH_CHATS_STORE, "readonly", (store) =>
    store.getAll(),
  );
  if (!rows) return 0;

  // Comparing ISO days as strings is a date comparison: the format is fixed-width and
  // lexicographically ordered, so no Date parsing and no timezone to get wrong.
  const cutoff = shiftDay(today, -retentionDays);
  const stale = (rows ?? []).filter((row) => row.id < cutoff);

  for (const row of stale) {
    await tx(COACH_CHATS_STORE, "readwrite", (store) => store.delete(row.id));
  }
  return stale.length;
}

/** `YYYY-MM-DD` moved by whole days, in UTC. */
function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The turns to send upstream, oldest first.
 *
 * Error bubbles are excluded on purpose. They are not conversation -- they are the app
 * telling the athlete something went wrong -- and replaying "rate limited" to the
 * model invites it to apologise for a failure it had no part in.
 */
export function toConversationTurns(messages: ChatMessage[]): {
  role: "user" | "assistant";
  content: string;
}[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .filter((message) => !message.isStreaming && message.content.trim() !== "")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
}