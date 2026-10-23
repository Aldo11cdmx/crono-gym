/**
 * useCsvImport.ts — owns the worker, and does not own the logic.
 *
 * Everything expensive is in `lib/import` and is pure, so this hook is the whole
 * of the off-main-thread story: spawn, post, report progress, hand back an
 * analysis. The fallback matters more than it looks -- jsdom has no `Worker`, and
 * neither does any browser that predates module workers. Rather than refuse to
 * import on those, the same pure functions run inline. A slower import beats no
 * import.
 *
 * The worker is created lazily and terminated on unmount. Creating it eagerly on
 * mount would download and compile a worker bundle for every user on every
 * screen, including the ones who never open the importer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeImport, type RawRow } from "@/lib/import/analyze";
import { createCsvParser } from "@/lib/import/csv";
import { detectSource, suggestMapping } from "@/lib/import/sources";
import type {
  ColumnMapping,
  ImportAnalysis,
  ImportSource,
} from "@/lib/import/types";
import type { ImportFile, WorkerRequest, WorkerResponse } from "@/lib/import/workerProtocol";
import type { WeightUnit } from "@/context/GymSettingsContext";

/** Rows kept for the preview table. */
const PREVIEW_ROWS = 5;

export interface CsvPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
  truncated: boolean;
}

export interface CsvImportState {
  /** True while a file is being read. */
  reading: boolean;
  /** 0..1, or null before the first progress message. */
  progress: number | null;
  /** True when this browser had to parse on the main thread. */
  fallback: boolean;
  preview: CsvPreview | null;
  analysis: ImportAnalysis | null;
  error: string | null;
  /** Source the file was recognised as, once a file has been read. */
  detectedSource: ImportSource | null;
  /**
   * The mapping the analysis was actually produced with.
   *
   * Held here rather than in the wizard so the columns shown and the numbers
   * counted can only ever come from the same run: the wizard edits a copy, sends
   * it back through `read`, and renders what the worker says it used.
   */
  mapping: ColumnMapping | null;
}

export interface ReadOptions {
  source?: ImportSource;
  mapping?: ColumnMapping;
  weightUnit?: WeightUnit;
  existing?: ReadonlySet<string>;
}

const INITIAL: CsvImportState = {
  reading: false,
  progress: null,
  fallback: false,
  preview: null,
  analysis: null,
  error: null,
  detectedSource: null,
  mapping: null,
};

/**
 * Vite resolves this to the built worker bundle.
 *
 * `new URL(...)` rather than a bare specifier so Vite can hash the file and
 * `vite build` fails loudly if the worker is missing -- a silent `null` module
 * would otherwise become a runtime `TypeError` on the first import.
 */
function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/importCsv.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    // CSP without `worker-src blob:` throws here rather than at first use.
    return null;
  }
}

export function useCsvImport() {
  const [state, setState] = useState<CsvImportState>(INITIAL);
  const workerRef = useRef<Worker | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      // A terminated worker holding a half-read file is a leak that survives the
      // unmount, and the wizard is reachable from more than one screen.
      aliveRef.current = false;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState(INITIAL);
  }, []);

  /**
   * Reads a file and analyses it.
   *
   * `existing` is passed as a fingerprint set so a re-import is a no-op; it is
   * read at call time rather than captured, because the caller fetches it
   * asynchronously and by the time this runs it may already have arrived.
   */
  const read = useCallback(async (file: ImportFile, options: ReadOptions = {}) => {
    workerRef.current?.terminate();
    workerRef.current = null;

    setState({ ...INITIAL, reading: true });

    const worker = createWorker();
    if (worker) {
      const result = await runInWorker(worker, file, options, (patch) => {
        if (aliveRef.current) setState((prev) => ({ ...prev, ...patch }));
      });
      worker.terminate();
      if (!aliveRef.current) return;
      setState(result);
      return;
    }

    setState((prev) => ({ ...prev, fallback: true }));
    const inline = await runInline(file, options);
    if (!aliveRef.current) return;
    setState(inline);
  }, []);

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState((prev) => ({ ...prev, reading: false, progress: null }));
  }, []);

  return { state, read, reset, cancel };
}

interface Patch {
  reading?: boolean;
  progress?: number | null;
  error?: string | null;
}

async function runInWorker(
  worker: Worker,
  file: ImportFile,
  options: ReadOptions,
  onPatch: (patch: Patch) => void,
): Promise<CsvImportState> {
  return new Promise<CsvImportState>((resolve) => {
    const finish = (state: CsvImportState) => {
      worker.onmessage = null;
      worker.onerror = null;
      resolve(state);
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;

      if (message.type === "progress") {
        onPatch({
          progress: message.done > 0 ? Math.min(1, message.read / message.done) : null,
        });
        return;
      }

      if (message.type === "error") {
        finish({ ...INITIAL, error: message.message });
        return;
      }

      finish({
        reading: false,
        progress: 1,
        fallback: false,
        error: null,
        detectedSource: message.sourceDetected ?? null,
        mapping: message.mapping ?? options.mapping ?? null,
        analysis: message.analysis,
        preview: message.headers
          ? {
              headers: message.headers,
              rows: (message.preview ?? []).map((row) => row.cells),
              totalRows: message.analysis.stats.totalRows,
              truncated: message.previewTruncated ?? false,
            }
          : null,
      });
    };

    worker.onerror = () => {
      finish({ ...INITIAL, error: "worker" });
    };

    const request: WorkerRequest = {
      type: "parse",
      file,
      source: options.source,
      mapping: options.mapping,
      weightUnit: options.weightUnit,
      existing: options.existing ? [...options.existing] : undefined,
    };
    worker.postMessage(request);
  });
}

/**
 * The same work, on the calling thread.
 *
 * Byte-identical to the worker's loop on purpose: the fallback exists for browsers
 * without module workers, and a second implementation would mean a second set of
 * bugs on exactly the browsers least able to report them.
 */
async function runInline(
  file: ImportFile,
  options: ReadOptions,
): Promise<CsvImportState> {
  const rows: RawRow[] = [];
  let headers: string[] | null = null;

  const parser = createCsvParser((cells, line) => {
    if (headers === null) {
      if (cells.every((cell) => cell.trim() === "")) return;
      headers = cells.map((cell, i) => {
        const trimmed = cell.trim();
        return trimmed === "" ? `columna_${i + 1}` : trimmed;
      });
      return;
    }
    rows.push({ cells, line });
  });

  if (typeof file.stream === "function") {
    const reader = file.stream().getReader();
    const decoder = new TextDecoder("utf-8");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    parser.feed(decoder.decode());
  } else {
    parser.feed(await file.text());
  }
  parser.end();

  if (headers === null) {
    return { ...INITIAL, fallback: true, error: "empty" };
  }

  const source = options.source ?? detectSource(headers);
  const mapping = options.mapping ?? suggestMapping(headers, source);
  const analysis = analyzeImport(headers, rows, {
    mapping,
    source,
    weightUnit: options.weightUnit,
    existing: options.existing,
  });

  return {
    reading: false,
    progress: 1,
    fallback: true,
    error: null,
    detectedSource: source,
    mapping,
    analysis,
    preview: {
      headers,
      rows: rows.slice(0, PREVIEW_ROWS).map((row) => row.cells),
      totalRows: rows.length,
      truncated: rows.length > PREVIEW_ROWS,
    },
  };
}