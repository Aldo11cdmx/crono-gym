/**
 * workerProtocol.ts — the messages that cross the worker boundary.
 *
 * Its own module because the wire format is a contract between two runtimes:
 * the worker's globals do not exist on the main thread, so a test that wants to
 * assert the message shapes would otherwise have to construct them by hand and
 * trust that both sides agree. Sharing the types is what makes a renamed field a
 * compile error instead of a `undefined` arriving at runtime.
 *
 * Note what is *not* here: no `File`. `File` is structured-cloneable and works
 * fine, but it cannot be written in a test fixture without a real file, so the
 * request carries the narrower {@link ImportFile} shape instead and both sides
 * accept anything that streams or textifies.
 */

import type { ColumnMapping, ImportAnalysis, ImportSource } from "./types";
import type { WeightUnit } from "@/context/GymSettingsContext";

export type { ColumnMapping, ImportSource };

/** The slice of `File` the worker actually uses. */
export interface ImportFile {
  readonly name: string;
  readonly size: number;
  stream?: () => ReadableStream<Uint8Array>;
  text: () => Promise<string>;
}

export interface ImportRequest {
  type: "parse";
  file: ImportFile;
  /** Forced by the wizard's source step; omitted on the first read. */
  source?: ImportSource;
  /** Forced by the wizard's mapping step; omitted on the first read. */
  mapping?: ColumnMapping;
  weightUnit?: WeightUnit;
  /** Fingerprints already in the database, for duplicate detection. */
  existing?: string[];
}

export interface CancelRequest {
  type: "cancel";
}

export type WorkerRequest = ImportRequest | CancelRequest;

export interface ProgressMessage {
  type: "progress";
  read: number;
  done: number;
}

export interface AnalysisMessage {
  type: "analysis";
  analysis: ImportAnalysis;
  headers?: string[];
  preview?: { cells: string[]; line: number }[];
  previewTruncated?: boolean;
  sourceDetected?: ImportSource;
  mapping?: ColumnMapping;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type WorkerResponse = ProgressMessage | AnalysisMessage | ErrorMessage;