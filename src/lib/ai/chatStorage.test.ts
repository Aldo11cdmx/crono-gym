import { describe, expect, it } from "vitest";
import { CHAT_RETENTION_DAYS, chatDay, toConversationTurns } from "./chatStorage";
import type { ChatMessage } from "./types";

/**
 * These are the pure parts of the chat store. The IndexedDB paths are not covered
 * here, for the reason the rank history suite gives: jsdom has no IndexedDB, and
 * adding `fake-indexeddb` would test the library rather than this module. What
 * matters here is that day keys and the upstream projection are stable, because
 * those are what make a conversation survive a reload and what the model is shown.
 */

function message(partial: Partial<ChatMessage> & { content: string }): ChatMessage {
  return {
    id: partial.id ?? crypto.randomUUID(),
    role: partial.role ?? "user",
    timestamp: partial.timestamp ?? 0,
    ...partial,
  };
}

describe("chatDay", () => {
  it("formats as YYYY-MM-DD in UTC", () => {
    expect(chatDay(new Date("2026-06-01T12:00:00.000Z"))).toBe("2026-06-01");
  });

  it("does not shift across the local timezone", () => {
    // Late in the UTC day would roll over on a machine behind UTC, putting the
    // conversation on the previous day and splitting one thread across two rows.
    expect(chatDay(new Date("2026-06-01T23:30:00.000Z"))).toBe("2026-06-01");
    expect(chatDay(new Date("2026-06-01T00:30:00.000Z"))).toBe("2026-06-01");
  });

  it("accepts no argument and defaults to now", () => {
    expect(chatDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is fixed width, which is what lets ids sort as dates", () => {
    // Retention compares day strings with `<`. A variable-width format would make
    // "2026-6-1" sort after "2026-05-31" and delete the wrong rows.
    expect(chatDay(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
    expect(chatDay(new Date("2026-12-31T00:00:00.000Z"))).toBe("2026-12-31");
  });
});

describe("CHAT_RETENTION_DAYS", () => {
  it("is a month, not long enough to keep a year of transcripts", () => {
    // A month is what survives a reload and carries yesterday over. Anything longer
    // is months of possibly-sensitive training text on a shared device.
    expect(CHAT_RETENTION_DAYS).toBe(30);
  });
});

describe("toConversationTurns", () => {
  it("keeps only user and assistant turns, in order", () => {
    const turns = toConversationTurns([
      message({ content: "hola", role: "user" }),
      message({ content: "qué tal", role: "assistant" }),
      message({ content: "sube peso", role: "user" }),
    ]);
    expect(turns).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "qué tal" },
      { role: "user", content: "sube peso" },
    ]);
  });

  it("drops error bubbles", () => {
    // An error is the app reporting a failure, not something the athlete said. Replaying
    // "rate limited" to the model invites it to apologise for something it did not do.
    const turns = toConversationTurns([
      message({ content: "hola", role: "user" }),
      message({ content: "Has superado el límite", role: "error" }),
      message({ content: "sigue", role: "user" }),
    ]);
    expect(turns.map((turn) => turn.content)).toEqual(["hola", "sigue"]);
  });

  it("drops a message still being streamed", () => {
    // Sending a half-written answer teaches the model to continue its own partial
    // sentence, and it will have been superseded by the time the request lands.
    const turns = toConversationTurns([
      message({ content: "hola", role: "user" }),
      message({ content: "Sub", role: "assistant", isStreaming: true }),
    ]);
    expect(turns.map((turn) => turn.content)).toEqual(["hola"]);
  });

  it("drops an empty message", () => {
    const turns = toConversationTurns([
      message({ content: "   ", role: "user" }),
      message({ content: "", role: "assistant" }),
      message({ content: "hola", role: "user" }),
    ]);
    expect(turns.map((turn) => turn.content)).toEqual(["hola"]);
  });

  it("returns an empty list for an empty transcript", () => {
    expect(toConversationTurns([])).toEqual([]);
  });
});