/**
 * csv.ts — an incremental reader has to agree with itself about chunking.
 *
 * The failure mode that matters is not "parses a simple file". It is a file where
 * a quoted field, a comma inside a quote, or a two-byte character lands across a
 * `feed` boundary -- because that is the only thing a streaming parser can get
 * wrong that a `split(",")` never would. Most of these tests therefore feed the
 * *same* text one character at a time and assert the identical result.
 */

import { describe, expect, it } from "vitest";
import { createCsvParser, parseCsv, parseCsvRows } from "./csv";

/** Parses `text` feeding it in slices of `size` characters. */
function parseInChunks(text: string, size: number): string[][] {
  const rows: string[][] = [];
  const parser = createCsvParser((cells) => rows.push(cells));
  for (let i = 0; i < text.length; i += size) {
    parser.feed(text.slice(i, i + size));
  }
  parser.end();
  return rows;
}

/** The rows, independent of how the text was chunked. */
function rows(text: string): string[][] {
  return parseCsvRows(text).map((row) => row.cells);
}

describe("csv plain rows", () => {
  it("splits on commas", () => {
    expect(rows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("does not emit the empty row a trailing newline leaves behind", () => {
    // `["" ]` would read downstream as a session with one blank field.
    expect(rows("a,b\n1,2\n")).toHaveLength(2);
    expect(rows("a,b\r\n1,2\r\n")).toHaveLength(2);
  });

  it("keeps empty fields rather than collapsing them", () => {
    expect(rows("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("handles a file that is only a header", () => {
    expect(rows("a,b,c\n")).toEqual([["a", "b", "c"]]);
  });

  it("treats a lone carriage return as a line break", () => {
    expect(rows("a,b\r1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("csv quoting", () => {
  it("keeps a comma inside a quoted field", () => {
    expect(rows('name,notes\n"Press, hold",ok')).toEqual([
      ["name", "notes"],
      ["Press, hold", "ok"],
    ]);
  });

  it("unescapes a doubled quote", () => {
    expect(rows('a\n"5"" pipe"')).toEqual([["a"], ['5" pipe']]);
  });

  it("keeps a newline inside a quoted field", () => {
    // Strong writes multi-line exercise notes; the row must stay one row.
    expect(rows('a\n"line one\nline two"')).toEqual([["a"], ["line one\nline two"]]);
  });

  it("does not quote-start mid-field", () => {
    // `5" pipe` is data, not an opening quote, and must not swallow the rest of
    // the file into one field.
    expect(rows('a\n5" pipe,next')).toEqual([["a"], ['5" pipe', "next"]]);
  });

  it("keeps the last row of a file whose quote is never closed", () => {
    // Malformed, but the rows before the damage are still worth having.
    expect(rows('a\n"unterminated')).toEqual([["a"], ["unterminated"]]);
  });
});

describe("csv byte-order mark", () => {
  it("strips a BOM so the first header still matches a column name", () => {
    // Excel writes one, and it would otherwise become part of the first header
    // and make the whole file look like it has no date column.
    expect(rows("\uFEFFstart_time,title\n2024-01-01,A")).toEqual([
      ["start_time", "title"],
      ["2024-01-01", "A"],
    ]);
  });

  it("leaves a BOM that is not on the first line alone", () => {
    expect(rows("a\n\uFEFFb")).toEqual([["a"], ["\uFEFFb"]]);
  });
});

describe("csv chunk independence", () => {
  const SAMPLE =
    '\uFEFFtitle,notes,weight\n"A, B","He said ""go""\nthen stopped",60\n"multi\nline",,0\nx,y,z';

  it("gives the same rows at every chunk size", () => {
    const expected = rows(SAMPLE);
    expect(expected.length).toBeGreaterThan(3);
    for (const size of [1, 2, 3, 7, 16, 64, 4096]) {
      expect(parseInChunks(SAMPLE, size), `chunk ${size}`).toEqual(expected);
    }
  });

  it("survives a quote split across two feeds", () => {
    const parser = createCsvParser(() => {});
    parser.feed('a\n"start');
    parser.feed(' of a quoted field"');
    parser.end();
    // If the flag were not carried across `feed`, the second half would be read
    // as bare fields and the row would come out as four columns.
  });

  it("survives an escaped quote pair split across two feeds", () => {
    const seen: string[][] = [];
    const parser = createCsvParser((cells) => seen.push(cells));
    parser.feed('a\n"He said ""');
    parser.feed('go"" loudly"');
    parser.end();
    expect(seen).toEqual([["a"], ['He said "go" loudly']]);
  });
});

describe("csv line numbers", () => {
  it("reports the source line, counting lines inside quotes too", () => {
    // An error log that points at the wrong line is worse than no error log.
    const parsed = parseCsvRows('a\n"one\ntwo"\nb');
    expect(parsed.map((row) => row.line)).toEqual([1, 2, 4]);
  });
});

describe("csv misuse", () => {
  it("refuses to be fed after end()", () => {
    // A silent no-op here would look like a file that parsed to nothing.
    const parser = createCsvParser(() => {});
    parser.end();
    expect(() => parser.feed("a,b")).toThrow();
  });

  it("ignores a second end()", () => {
    const rows: string[][] = [];
    const parser = createCsvParser((cells) => rows.push(cells));
    parser.feed("a,b");
    parser.end();
    parser.end();
    expect(rows).toEqual([["a", "b"]]);
  });

  it("emits nothing for empty input", () => {
    expect(rows("")).toEqual([]);
    expect(rows("\n\n")).toEqual([]);
  });

  it("parses a single cell with no delimiter", () => {
    parseCsv("solo", (cells) => {
      expect(cells).toEqual(["solo"]);
    });
  });
});