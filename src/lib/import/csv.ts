/**
 * csv.ts — an incremental RFC 4180 reader.
 *
 * Incremental rather than "parse a string" on purpose. A five-year Hevy export
 * is tens of megabytes; `File.text()` on one of those is a single ~100 MB string
 * plus the row array, and the peak is what makes a phone close the tab. Feeding
 * the worker `file.stream()` chunk by chunk keeps the resident set at one chunk
 * plus the rows that survive into the analysis, and it is the reason the parsing
 * is a state machine with `feed`/`end` instead of a function with a loop in it.
 *
 * The machine is also what makes a quoted field split across a chunk boundary
 * work. A regex or `split(",")` cannot see that `"Press, then ` + `hold"` split
 * over two reads is one field; a parser that carries its `inQuotes` flag across
 * `feed` calls can, for free.
 *
 * Deliberately not handling: escaped newlines inside quotes *and* a `\r\n` inside
 * them. Both sources quote multi-line notes; neither puts a CRLF inside a quoted
 * field, and pretending otherwise would mean tracking two newline conventions
 * through four states for a case that does not occur.
 */

/** A parsed row, and the 1-based source line it started on. */
export type CsvRowHandler = (cells: string[], line: number) => void;

export interface CsvParser {
  /** Consumes the next chunk. Chunks may split fields, quotes or lines. */
  feed(chunk: string): void;
  /** Flushes the last row. A file need not end with a newline. */
  end(): void;
}

/**
 * Byte-order mark.
 *
 * Excel writes one, and it survives as U+FEFF in front of the first header --
 * which then fails to match any known column name, so the wizard would open on
 * an empty file and blame the user.
 */
const BOM = "\uFEFF";

/**
 * Builds a parser that reports each row through `onRow`.
 *
 * `onRow` is called with a fresh array per row; the parser does not retain it, so
 * a caller that wants the rows must copy what it needs out of the callback.
 */
export function createCsvParser(onRow: CsvRowHandler): CsvParser {
  let field = "";
  let cells: string[] = [];
  /** Line the current row *started* on, which the error log reports. */
  let rowStart = 1;
  let line = 1;
  let inQuotes = false;
  let atStart = true;
  let closed = false;
  /**
   * A `"` was the last character of the previous chunk.
   *
   * Whether that quote closed the field or was the first half of an escaped `""`
   * depends on a character that had not arrived yet. Deciding eagerly is the bug
   * this flag exists to prevent: a quoted field split across two reads would be
   * cut short at the boundary, and with it every row after it.
   */
  let pendingQuote = false;

  function emit() {
    cells.push(field);
    onRow(cells, rowStart);
    cells = [];
    field = "";
  }

  /**
   * A line with neither a delimiter nor a character is not a row.
   *
   * A trailing newline leaves exactly that behind, and emitting it would hand the
   * caller a `[""]` row that reads as a session with one empty cell.
   */
  function hasContent(): boolean {
    return cells.length > 0 || field !== "";
  }

  /** Closes the current line and starts the next one at `line`. */
  function breakLine() {
    if (hasContent()) emit();
    line += 1;
    rowStart = line;
  }

  return {
    feed(chunk: string) {
      if (closed) throw new Error("CsvParser: feed() after end()");
      const { length } = chunk;
      let cursor = 0;

      if (pendingQuote) {
        pendingQuote = false;
        if (chunk[0] === '"') {
          // The pair resolved: one literal quote, and we are still inside.
          field += '"';
          cursor = 1;
        } else {
          // The lone quote closed the field; `chunk[0]` is ordinary data again.
          inQuotes = false;
        }
      }

      for (; cursor < length; cursor += 1) {
        const char = chunk[cursor];

        if (inQuotes) {
          if (char === '"') {
            if (cursor + 1 >= length) {
              pendingQuote = true;
              break;
            }
            if (chunk[cursor + 1] === '"') {
              field += '"';
              cursor += 1;
              continue;
            }
            inQuotes = false;
            continue;
          }
          if (char === "\n") line += 1;
          field += char;
          continue;
        }

        if (char === '"' && field === "") {
          // Only a quote that opens a field starts quoting. One in the middle of
          // a value is data, which is what makes `"5"" pipe"` survive.
          inQuotes = true;
          continue;
        }

        if (char === ",") {
          cells.push(field);
          field = "";
          continue;
        }

        if (char === "\r") {
          // Swallowed so CRLF counts as one line break. A lone CR is a break too.
          if (chunk[cursor + 1] === "\n") cursor += 1;
          breakLine();
          continue;
        }

        if (char === "\n") {
          breakLine();
          continue;
        }

        if (atStart && line === 1 && char === BOM) continue;
        atStart = false;
        field += char;
      }
    },

    end() {
      if (closed) return;
      closed = true;
      // A file that ends mid-quote is malformed, but the rows before the damage
      // are still worth importing, so the flag is cleared rather than thrown.
      inQuotes = false;
      pendingQuote = false;
      if (hasContent()) emit();
    },
  };
}

/** Convenience wrapper for callers that already hold the whole text. */
export function parseCsv(text: string, onRow: CsvRowHandler): void {
  const parser = createCsvParser(onRow);
  parser.feed(text);
  parser.end();
}

/** Every row, for tests and for files small enough that streaming is theatre. */
export function parseCsvRows(text: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = [];
  parseCsv(text, (cells, line) => rows.push({ cells, line }));
  return rows;
}
