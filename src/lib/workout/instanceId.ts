/**
 * instanceId.ts — a fresh identity for something that is about to exist.
 *
 * A session is an *instance* of a plan. Two runs of the same routine are two
 * different sessions, and the third set of the second run is not the third set
 * of the first one. Sharing an identity between them would make the tracker
 * read one run's attempt as the other's, so every instance that belongs to a
 * run carries an id of its own.
 *
 * The id is deliberately independent of whatever the thing was copied from: a
 * session's ids say nothing about the routine it came from, which is what
 * makes the template and the run two separate things.
 *
 * `crypto.randomUUID` needs a secure context. The fallback keeps the app
 * usable over plain http on a LAN, where `crypto` exists but `randomUUID`
 * does not, and the last resort keeps it usable where `crypto` is missing
 * altogether.
 */

/** A fresh v4 UUID. */
export function newInstanceId(): string {
  const source = globalThis.crypto;

  if (source && typeof source.randomUUID === "function") return source.randomUUID();

  const bytes = new Uint8Array(16);
  if (source && typeof source.getRandomValues === "function") {
    source.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // Version 4, variant 1: the two nibbles that make the value a well-formed
  // v4 UUID rather than sixteen random bytes.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
