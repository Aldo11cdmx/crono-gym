/**
 * mojibake.ts — text that was written as UTF-8 and read as Latin-1.
 *
 * The shipped exercise dataset (and the Spanish name dictionary derived from it)
 * carries accented characters in both encodings: some rows are clean, some read
 * "FlexiÃ³n" instead of "Flexión". The bytes are still there — every character of
 * the broken string is the Latin-1 reading of one UTF-8 byte — so the text can be
 * recovered by taking each character code as a byte and decoding it as UTF-8.
 *
 * The repair only runs when the text actually looks broken, and the result is
 * accepted only when it decodes cleanly, so a name that legitimately contains
 * "Ã" is left alone.
 */

/** A UTF-8 byte read as Latin-1: "Ã" or "Â" followed by a continuation byte. */
const MOJIBAKE_MARKER = /Ã[\u0080-\u00BF]|Â[\u00A0-\u00BF]/;

export function hasMojibake(value: string): boolean {
  return MOJIBAKE_MARKER.test(value);
}

/**
 * Returns the text as it was meant to be written, or the input when it is not
 * broken or cannot be recovered.
 */
export function repairMojibake(value: string | null | undefined): string {
  if (!value || !hasMojibake(value)) return value ?? "";
  try {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      bytes[index] = value.charCodeAt(index) & 0xff;
    }
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // A repair that leaves the marker, or that turns most of the string into
    // replacement characters, is not a repair.
    if (!decoded || hasMojibake(decoded)) return value;
    const replacements = (decoded.match(/\uFFFD/g) ?? []).length;
    if (replacements > 1) return value;
    return decoded;
  } catch {
    return value;
  }
}