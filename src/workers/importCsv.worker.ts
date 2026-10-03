/// <reference lib="webworker" />
/**
 * importCsv.worker.ts — parse and analyse a CSV off the main thread.
 *
 * A five-year export is tens of thousands of rows. Parsing and grouping that
 * synchronously on the main thread blocks for seconds, and a blocked main thread
 * is a frozen app: no scroll, no cancel, and on a phone the OS offers to kill
 * the tab. So the two expensive steps live here and the main thread only ever
 * receives a finished {@link ImportAnalysis}.
 *
 * The worker streams. `file.stream()` is read chunk by chunk and each chunk is
 * fed straight into the parser, so the file is never resident in full -- which is
 * the difference between a 40 MB import working on a mid-range phone and the tab
 * dying on it. Rows are buffered only because grouping sessions needs them; they
 * are released as soon as the analysis is posted.
 *
 * Everything it calls is pure and lives in `lib/import`, so the tests exercise
 * this exact logic on the main thread and the worker adds only the plumbing.
 */

import { analyzeImport, type RawRow } from "@/lib/import/analyze";
import { createCsvParser } from "@/lib/import/csv";
import { detectSource, suggestMapping } from "@/lib/import/sources";
import type {
  ColumnMapping,
  ImportSource,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/import/workerProtocol";

/** Header and first rows, for the wizard's preview without shipping the whole file. */
const PREVIEW_ROWS = 5;

/**
 * Rows buffered before the first `progress` message.
 *
 * Chosen to be frequent enough that the bar moves on a fast machine and rare
 * enough that posting a message per row would cost more than the parsing does on
 * a slow one.
 */
const PROGRESS_EVERY = 2000;

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerResponse): void {
  scope.postMessage(message);
}

/**
 * The header row is the first row that parses to something usable.
 *
 * Both sources write it on line 1, but an exported file that has been through a
 * spreadsheet often carries a blank line or a title above it, so the reader
 * skips empties rather than assuming.
 */
function readHeader(
  cells: string[],
): { headers: string[]; line: number } | null {
  if (cells.every((cell) => cell.trim() === "")) return null;
  const headers = cells.map((cell, i) => {
    const trimmed = cell.trim();
    // An unnamed column still needs an identity for the mapping table to show.
    return trimmed === "" ? `columna_${i + 1}` : trimmed;
  });
  return { headers, line: 0 };
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    if (request.type === "cancel") return;

    const file = request.file;
    const rows: RawRow[] = [];
    let headers: string[] | null = null;
    let nextProgress = PROGRESS_EVERY;

    const parser = createCsvParser((cells, at) => {
      if (headers === null) {
        const header = readHeader(cells);
        if (header === null) return; // A blank leading line.
        headers = header.headers;
        return;
      }
      rows.push({ cells, line: at });
      if (rows.length >= nextProgress) {
        nextProgress += PROGRESS_EVERY;
        post({ type: "progress", read: rows.length, done: file.size || 0 });
      }
    });

    if (typeof file.stream === "function") {
      const reader = file.stream().getReader();
      const decoder = new TextDecoder("utf-8");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      // Flush the decoder: a multi-byte character split across two chunks would
      // otherwise come out as a replacement character in the last cell.
      parser.feed(decoder.decode());
    } else {
      parser.feed(await file.text());
    }
    parser.end();

    if (headers === null) {
      // Nothing but blank lines. `analyzeImport` turns this into the single
      // file-level issue the wizard shows instead of an empty table.
      post({
        type: "analysis",
        analysis: analyzeImport([], [], {
          mapping: emptyMapping(),
          source: request.source ?? "generic",
        }),
      });
      return;
    }

    const source: ImportSource = request.source ?? detectSource(headers);
    const mapping: ColumnMapping = request.mapping ?? suggestMapping(headers, source);

    post({
      type: "analysis",
      analysis: analyzeImport(headers, rows, {
        mapping,
        source,
        weightUnit: request.weightUnit,
        existing: request.existing ? new Set(request.existing) : undefined,
      }),
      headers,
      preview: rows.slice(0, PREVIEW_ROWS),
      previewTruncated: rows.length > PREVIEW_ROWS,
      sourceDetected: source,
      mapping,
    });
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

function emptyMapping(): ColumnMapping {
  return {
    date: null,
    title: null,
    exercise: null,
    weight: null,
    reps: null,
    rpe: null,
    setNumber: null,
    setType: null,
    notes: null,
  };
}