/**
 * ImportWizard.tsx — four steps from a CSV on disk to a committed batch.
 *
 *   1. Fuente       — which app, which file, and what unit its weights are in
 *   2. Vista previa — what was read, and everything that was not
 *   3. Mapeo        — confirm the columns, then assign a muscle per exercise
 *   4. Confirmación — the counts, then write; undo for as long as it is offered
 *
 * Three decisions carry the design:
 *
 * **Nothing is written until step 4, and step 4 is reversible.** An import that
 * lands in the database and cannot be taken back is not something to run off a
 * guessed column mapping. Every committed batch keeps its ids, so undo removes
 * exactly the sessions that batch wrote -- not the file's worth, and not
 * everything the user has.
 *
 * **Re-reading is a full re-analysis, not a patch.** Changing the source or a
 * column re-runs the parse through the same worker, because the analysis is a
 * pure function of (file, source, mapping) and reusing a stale result is how a
 * wizard ends up confirming numbers that no longer match what it will write.
 *
 * **The muscle step is what resolves names to ids.** Rather than fuzzy-matching a
 * CSV's "Sentadilla" against the catalogue -- which silently credits a set to the
 * wrong movement and therefore to the wrong muscle in the ranks engine -- the
 * user picks the muscle on an anatomical map and the name is matched inside it.
 * Anything left unresolved is reported, never guessed.
 */

import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Slug } from "react-muscle-highlighter";
import { AlertTriangle, Check, FileUp, Undo2 } from "lucide-react";
import { GlassButton, GlassCard } from "@/components/ui";
import { MuscleSelector } from "@/components/MuscleSelector";
import { useCsvImport } from "@/hooks/useCsvImport";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { IMPORT_LABELS as T, MUSCLE_FILTER_LABELS } from "@/lib/i18n";
import { REQUIRED_FIELDS, missingRequired } from "@/lib/import/sources";
import { commitBatch, planBatch, undoBatch, type CommitResult } from "@/lib/import/commit";
import {
  CANONICAL_FIELDS,
  IMPORT_SOURCES,
  type CanonicalField,
  type ColumnMapping,
  type ImportAnalysis,
  type ImportIssue,
  type ImportSource,
} from "@/lib/import/types";
import type { ImportFile } from "@/lib/import/workerProtocol";
import type { WeightUnit } from "@/context/GymSettingsContext";
import {
  ACCENT,
  DANGER,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SOLID,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";

/** The four steps, in order. The array is the state machine. */
export const IMPORT_STEPS = [
  { id: 0, name: T.stepSource },
  { id: 1, name: T.stepPreview },
  { id: 2, name: T.stepMapping },
  { id: 3, name: T.stepConfirm },
] as const;

/** Above this the file is worth warning about before parsing it. */
export const LARGE_FILE_BYTES = 25 * 1024 * 1024;

export interface ImportWizardProps {
  userId: string;
  onClose: () => void;
  /** Called once a batch has landed, so the host can refresh and close. */
  onImported?: (result: CommitResult) => void;
}

export function ImportWizard({ userId, onClose, onImported }: ImportWizardProps) {
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [file, setFile] = useState<ImportFile | null>(null);
  const [muscles, setMuscles] = useState<Record<string, Slug | "">>({});
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undone, setUndone] = useState<string | null>(null);

  const { state, read, reset } = useCsvImport();
  const catalog = useExerciseCatalog(userId);

  const analysis = state.analysis;
  // The mapping is deliberately *not* held in state: the worker returns the one
  // it used, so there is exactly one authority and the selects cannot drift from
  // the numbers on screen.
  const mapping = state.mapping;
  const headers = state.preview?.headers ?? [];

  const reread = useCallback(
    (next: { source?: ImportSource; unit?: WeightUnit; mapping?: ColumnMapping }) => {
      if (!file) return;
      void read(file, {
        source: next.source ?? source ?? undefined,
        mapping: next.mapping,
        weightUnit: next.unit ?? unit,
      });
    },
    [file, read, source, unit],
  );

  const chooseFile = useCallback(
    (picked: ImportFile | null) => {
      setFile(picked);
      setSource(null);
      setMuscles({});
      setUndone(null);
      setCommitResult(null);
      reset();
      // Read immediately, with no forced source, so the file is detected before
      // the user has to choose anything. Deferring the read to the source chip
      // meant the "we detected a Hevy export" line could never appear, because
      // by the time a source was chosen there was nothing left to detect.
      if (picked) void read(picked, { weightUnit: unit });
    },
    [read, reset, unit],
  );

  const chooseSource = useCallback(
    (next: ImportSource) => {
      setSource(next);
      // The mapping is a function of the source, so it is recomputed rather than
      // patched: Hevy's `weight_kg` and Strong's `Weight` are different columns.
      if (file) void read(file, { source: next, weightUnit: unit });
    },
    [file, read, unit],
  );

  const setMappingField = useCallback(
    (field: CanonicalField, header: string | null) => {
      if (!mapping) return;
      const next = { ...mapping, [field]: header };
      // A required field emptied out cannot be parsed at all, so the re-read is
      // skipped rather than run against a mapping guaranteed to import nothing.
      if (missingRequired(next).length > 0) return;
      reread({ mapping: next });
    },
    [mapping, reread],
  );

  const missing = useMemo(() => (mapping ? missingRequired(mapping) : []), [mapping]);
  const importable = (analysis?.sessions.length ?? 0) > 0;

  // Hoisted out of the step-2 branch on purpose. Called inline in the JSX they
  // would be conditional hooks, and stepping 0 -> 2 -> 1 is an ordinary thing for
  // this wizard to do -- React would throw "rendered fewer hooks than expected"
  // the first time a user pressed Atrás.
  const resolved = useResolvedCount(analysis, catalog.find, muscles);
  const unresolved = useUnresolvedNames(analysis, catalog.find, muscles);

  const commit = useCallback(async () => {
    // The analysis carries the source it was actually read as. Gating on the
    // source chip instead would silently refuse to import a file the app had
    // detected correctly, because the user never touched the chip.
    if (!analysis) return;
    setCommitting(true);
    try {
      const batch = planBatch(analysis.sessions, {
        userId,
        batchId: analysis.batchId,
        resolveExercise: (name) => catalog.find(name, muscles[name] ?? null)?.id ?? null,
      });
      const result = await commitBatch(batch);
      setCommitResult(result);
      onImported?.(result);
    } finally {
      setCommitting(false);
    }
  }, [analysis, userId, catalog, muscles, onImported]);

  const undo = useCallback(async () => {
    if (!commitResult) return;
    setUndoBusy(true);
    const result = await undoBatch(commitResult.written);
    // The honest failure: a refusal to say "done" when the rows are still there.
    // Showing the success copy while the data survives is worse than no undo.
    setUndone(result.failures.length > 0 ? T.undoUnavailable : T.undoDone);
    setCommitResult(null);
    setUndoBusy(false);
  }, [commitResult]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cronos-import-title"
      style={overlayStyle}
    >
      <GlassCard style={panelStyle}>
        <header style={headerStyle}>
          <div>
            <h2 id="cronos-import-title" style={titleStyle}>
              {T.title}
            </h2>
            <p style={subtitleStyle}>
              {T.step(step + 1, IMPORT_STEPS.length, IMPORT_STEPS[step].name)}
            </p>
          </div>
          <GlassButton variant="ghost" onClick={onClose} aria-label={T.close}>
            {T.close}
          </GlassButton>
        </header>

        <ol style={stepsStyle}>
          {IMPORT_STEPS.map((entry) => (
            <li
              key={entry.id}
              aria-current={entry.id === step ? "step" : undefined}
              style={{
                ...stepStyle,
                color: entry.id <= step ? TEXT.primary : TEXT.tertiary,
                borderColor: entry.id === step ? ACCENT.base : GLASS.border,
              }}
            >
              {entry.name}
            </li>
          ))}
        </ol>

        <div style={bodyStyle}>
          {step === 0 && (
            <SourceStep
              source={source}
              unit={unit}
              file={file}
              reading={state.reading}
              progress={state.progress}
              fallback={state.fallback}
              detected={state.detectedSource}
              onSource={chooseSource}
              onUnit={(next) => {
                setUnit(next);
                reread({ unit: next });
              }}
              onFile={chooseFile}
            />
          )}

          {step === 1 && (
            <PreviewStep
              analysis={analysis}
              file={file}
              headers={headers}
              previewRows={state.preview?.rows ?? []}
              truncated={state.preview?.truncated ?? false}
            />
          )}

          {step === 2 && (
            <MappingStep
              analysis={analysis}
              headers={headers}
              mapping={mapping}
              missing={missing}
              resolved={resolved}
              unresolved={unresolved}
              onMapping={setMappingField}
              muscles={muscles}
              onMuscles={setMuscles}
            />
          )}

          {step === 3 && (
            <ConfirmStep
              analysis={analysis}
              committing={committing}
              result={commitResult}
              undone={undone}
              undoBusy={undoBusy}
              onUndo={undo}
            />
          )}
        </div>

        <footer style={footerStyle}>
          {step > 0 && (
            <GlassButton variant="ghost" onClick={() => setStep(step - 1)} disabled={committing}>
              {T.back}
            </GlassButton>
          )}
          {step < 3 ? (
            <GlassButton
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={!importable || state.reading}
            >
              {T.next}
            </GlassButton>
          ) : (
            <GlassButton
              variant="primary"
              onClick={() => void commit()}
              disabled={committing || commitResult !== null || !importable}
            >
              {committing ? T.confirmWorking : T.confirmStart}
            </GlassButton>
          )}
        </footer>
      </GlassCard>
    </div>
  );
}

// ------------------------------------------------------------- step one: source

function SourceStep({
  source,
  unit,
  file,
  reading,
  progress,
  fallback,
  detected,
  onSource,
  onUnit,
  onFile,
}: {
  source: ImportSource | null;
  unit: WeightUnit;
  file: ImportFile | null;
  reading: boolean;
  progress: number | null;
  fallback: boolean;
  detected: ImportSource | null;
  onSource: (source: ImportSource) => void;
  onUnit: (unit: WeightUnit) => void;
  onFile: (file: ImportFile | null) => void;
}) {
  return (
    <div style={stackStyle}>
      <div>
        <h3 style={h3Style}>{T.sourceTitle}</h3>
        <p style={hintStyle}>{T.sourceHint}</p>
      </div>

      {detected && (
        <p role="status" style={{ ...hintStyle, color: ACCENT.text }}>
          {T.sourceAutoDetected(T.sources[detected])}
        </p>
      )}

      <div style={chipRowStyle}>
        {IMPORT_SOURCES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={source === option}
            onClick={() => onSource(option)}
            style={chipStyle(source === option)}
          >
            {T.sources[option]}
          </button>
        ))}
      </div>

      <Field label={T.sourceWeightUnit}>
        <div style={chipRowStyle}>
          {(["kg", "lb"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={unit === option}
              onClick={() => onUnit(option)}
              style={chipStyle(unit === option)}
            >
              {option}
            </button>
          ))}
        </div>
      </Field>

      <Field label={T.fileLabel} hint={T.fileHint}>
        <label style={fileButtonStyle}>
          <FileUp size={16} aria-hidden="true" />
          {T.fileChoose}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={reading}
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p style={{ ...hintStyle, marginTop: SPACE.xs }}>
            {reading
              ? `${T.fileReading} ${progress === null ? "" : `${Math.round(progress * 100)}%`}`
              : T.fileRead(file.name, `${Math.round(file.size / 1024)} kB`)}
          </p>
        )}
        {file && file.size > LARGE_FILE_BYTES && !reading && (
          <p style={{ ...hintStyle, marginTop: SPACE.xs, color: STATUS.warning.text }}>
            {T.fileTooLarge(`${Math.round(LARGE_FILE_BYTES / 1024 / 1024)} MB`)}
          </p>
        )}
      </Field>

      {/*
        Said out loud rather than hidden: without module workers the parse runs
        on the main thread and the UI blocks while it does, and a user who cannot
        explain that to themselves will think the app has frozen.
      */}
      {fallback && (
        <p role="status" style={{ ...hintStyle, color: STATUS.warning.text }}>
          {T.workerFallingBack}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------- step two: preview

function PreviewStep({
  analysis,
  file,
  headers,
  previewRows,
  truncated,
}: {
  analysis: ImportAnalysis | null;
  file: ImportFile | null;
  headers: string[];
  previewRows: string[][];
  truncated: boolean;
}) {
  if (!analysis) return <p style={hintStyle}>{T.previewEmpty}</p>;

  return (
    <div style={stackStyle}>
      <div>
        <h3 style={h3Style}>{T.previewTitle}</h3>
        {file && <p style={hintStyle}>{T.fileRead(file.name, `${Math.round(file.size / 1024)} kB`)}</p>}
      </div>

      <Readout
        items={[
          T.previewRows(analysis.stats.totalRows),
          T.previewColumns(headers.length),
          T.previewShowing(previewRows.length, analysis.stats.totalRows),
        ]}
      />

      {analysis.stats.totalRows === 0 ? (
        <p style={hintStyle}>{T.previewEmpty}</p>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <caption className="sr-only">{T.previewTitle}</caption>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} scope="col" style={thStyle}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, cellIndex) => (
                    <td key={cellIndex} style={tdStyle}>
                      {row[cellIndex] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {truncated && <p style={hintStyle}>{T.previewTruncated}</p>}
        </div>
      )}

      <IssueLog issues={analysis.issues} />
    </div>
  );
}

// ----------------------------------------------------------- step three: mapping

function MappingStep({
  analysis,
  headers,
  mapping,
  missing,
  resolved,
  unresolved,
  onMapping,
  muscles,
  onMuscles,
}: {
  analysis: ImportAnalysis | null;
  headers: string[];
  mapping: ColumnMapping | null;
  missing: readonly CanonicalField[];
  resolved: number;
  unresolved: string[];
  onMapping: (field: CanonicalField, header: string | null) => void;
  muscles: Record<string, Slug | "">;
  onMuscles: (next: Record<string, Slug | "">) => void;
}) {
  // The name whose muscle is currently being assigned. One at a time, because
  // the selector is a full anatomical map and a list of forty maps is a wall.
  const [editing, setEditing] = useState<string | null>(null);
  const names = analysis?.exerciseNames ?? [];
  const editingName = editing ?? names[0] ?? null;
  const assigned = editingName ? (muscles[editingName] ?? "") : "";

  return (
    <div style={stackStyle}>
      <div>
        <h3 style={h3Style}>{T.mappingTitle}</h3>
        <p style={hintStyle}>{T.mappingHint}</p>
      </div>

      <div style={mapGridStyle}>
        {CANONICAL_FIELDS.map((field) => (
          <Field
            key={field}
            label={T.fields[field]}
            hint={REQUIRED_FIELDS.includes(field) ? T.mappingRequired : T.mappingOptional}
          >
            <select
              value={mapping?.[field] ?? ""}
              aria-label={T.fields[field]}
              disabled={!mapping}
              onChange={(event) =>
                onMapping(field, event.target.value === "" ? null : event.target.value)
              }
              style={selectStyle}
            >
              <option value="">{T.mappingNotInFile}</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>

      <p
        role="status"
        style={{ ...hintStyle, color: missing.length > 0 ? DANGER.text : ACCENT.text }}
      >
        {missing.length > 0
          ? T.mappingIncomplete.replace("{fields}", missing.map((f) => T.fields[f]).join(", "))
          : T.mappingComplete}
      </p>

      <div>
        <h4 style={h4Style}>{T.mappingExerciseToMuscle}</h4>
        <p style={hintStyle}>{T.mappingExerciseToMuscleHint}</p>

        <Readout
          items={[
            T.mappingResolvedCount(resolved, names.length),
            ...(unresolved.length > 0
              ? [T.mappingUnresolvedCount(unresolved.length)]
              : []),
          ]}
        />

        {/*
          The picker is a list, not a map of maps: forty anatomical figures would
          be unusable, so the list names the exercise and the map edits that one.
        */}
        <ul style={nameListStyle}>
          {names.map((name) => (
            <li key={name} style={nameRowStyle}>
              <span style={{ flex: 1, minWidth: 0 }}>{name}</span>
              <span
                style={{
                  ...hintStyle,
                  color: muscles[name] ? ACCENT.text : STATUS.warning.text,
                }}
              >
                {muscles[name]
                  ? T.mappingAssigned(muscles[name])
                  : T.mappingUnassigned}
              </span>
              <button
                type="button"
                style={smallButtonStyle}
                aria-pressed={editingName === name}
                onClick={() => setEditing(name)}
              >
                {T.mappingSelectMuscle}
              </button>
            </li>
          ))}
        </ul>

        {editingName && (
          <div style={{ marginTop: SPACE.md }}>
            <h4 style={h4Style}>
              {T.mappingEditing(editingName)}
            </h4>
            <MuscleSelector
              selected={assigned ? [assigned] : []}
              onChange={(next) => {
                const [slug] = next;
                onMuscles({ ...muscles, [editingName]: slug ?? "" });
              }}
              legendLabel={T.mappingEditing(editingName)}
            />
            <p style={{ ...hintStyle, marginTop: SPACE.xs }}>
              {MUSCLE_FILTER_LABELS.hint}
            </p>
          </div>
        )}
      </div>

      {/*
        Here rather than only on the confirm step because this is where a new
        batch of rows can be dropped: remapping a column re-runs the analysis, and
        the log the user needs to read is the new one, not the one from before
        they touched anything.
      */}
      {analysis && <IssueLog issues={analysis.issues} />}
    </div>
  );
}

// ---------------------------------------------------------- step four: confirm

function ConfirmStep({
  analysis,
  committing,
  result,
  undone,
  undoBusy,
  onUndo,
}: {
  analysis: ImportAnalysis | null;
  committing: boolean;
  result: CommitResult | null;
  undone: string | null;
  undoBusy: boolean;
  onUndo: () => void;
}) {
  if (undone) {
    return (
      <p role="status" style={successStyle}>
        <Undo2 size={16} aria-hidden="true" />
        {undone}
      </p>
    );
  }

  if (!analysis) return <p style={hintStyle}>{T.previewEmpty}</p>;

  if (result) {
    return (
      <div style={stackStyle}>
        <p role="status" style={successStyle}>
          <Check size={16} aria-hidden="true" />
          {T.confirmDone(result.written.length, analysis.stats.importedSets)}
        </p>

        {result.failures.length > 0 && (
          <IssueLog
            issues={result.failures.map((failure) => ({
              code: "no_sets" as const,
              line: null,
              message: failure.message,
              detail: failure.title,
            }))}
          />
        )}

        {result.written.length > 0 && (
          <GlassButton
            variant="secondary"
            icon={<Undo2 size={16} aria-hidden="true" />}
            onClick={onUndo}
            disabled={undoBusy}
          >
            {undoBusy ? T.confirmWorking : T.undo}
          </GlassButton>
        )}
      </div>
    );
  }

  return (
    <div style={stackStyle}>
      <h3 style={h3Style}>{T.confirmTitle}</h3>

      <Readout
        items={[
          T.confirmStats.sessions(analysis.stats.sessions),
          T.confirmStats.sets(analysis.stats.importedSets),
          T.confirmStats.exercises(analysis.stats.distinctExercises),
          ...(analysis.stats.skippedRows > 0
            ? [T.confirmStats.skipped(analysis.stats.skippedRows)]
            : []),
        ]}
      />

      {analysis.stats.duplicateSessions > 0 && (
        <p style={{ ...hintStyle, color: STATUS.warning.text, display: "flex", gap: SPACE.xs, alignItems: "center" }}>
          <AlertTriangle size={14} aria-hidden="true" />
          {T.confirmDuplicates(analysis.stats.duplicateSessions)}
        </p>
      )}

      {committing && (
        <p role="status" style={hintStyle}>
          {T.confirmWorking}
        </p>
      )}

      <IssueLog issues={analysis.issues} />
    </div>
  );
}

// -------------------------------------------------------------------- shared

/**
 * The error log, always rendered.
 *
 * Empty or not: an importer that only shows a log when something went wrong
 * teaches users that a clean screen means a complete import, which is exactly
 * the belief that hides a dropped row.
 */
function IssueLog({ issues }: { issues: readonly ImportIssue[] }) {
  const [open, setOpen] = useState(issues.length > 0);

  return (
    <section aria-label={T.issuesTitle}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" }}>
        <h4 style={h4Style}>{T.issuesTitle}</h4>
        {issues.length > 0 && (
          <>
            <span style={badgeStyle}>{T.issuesCount(issues.length)}</span>
            <GlassButton variant="ghost" onClick={() => setOpen(!open)}>
              {open ? T.issueDismiss : T.issueShow(issues.length)}
            </GlassButton>
          </>
        )}
      </div>

      {issues.length === 0 ? (
        <p style={hintStyle}>{T.issuesEmpty}</p>
      ) : (
        open && (
          <ul style={issueListStyle}>
            {issues.map((issue, i) => (
              <li key={`${issue.code}-${issue.line ?? "f"}-${i}`} style={issueRowStyle}>
                <span style={{ ...hintStyle, color: DANGER.text, whiteSpace: "nowrap" }}>
                  {issue.line === null ? T.issueFileWide : T.issueLine(issue.line)}
                </span>
                <span style={issueMessageStyle}>{issue.message}</span>
                {issue.detail && <span style={{ ...hintStyle, wordBreak: "break-all" }}>{issue.detail}</span>}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

function Readout({ items }: { items: string[] }) {
  return (
    <ul style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li key={item} style={badgeStyle}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
      {hint && <span style={{ ...hintStyle, display: "block", marginTop: 2 }}>{hint}</span>}
    </label>
  );
}

// -------------------------------------------------------------------- helpers

/**
 * Names the user's muscle assignments already resolve to a catalogue exercise.
 *
 * Counted here rather than at commit time because the mapping step has to tell
 * the user how much of their file is understood *before* they commit to it.
 */
function useResolvedCount(
  analysis: ImportAnalysis | null,
  find: (name: string, target?: string | null) => { id: string } | null,
  muscles: Readonly<Record<string, Slug | "">>,
): number {
  return useMemo(() => {
    if (!analysis) return 0;
    return analysis.exerciseNames.filter((name) => find(name, muscles[name] ?? null) !== null).length;
  }, [analysis, find, muscles]);
}

function useUnresolvedNames(
  analysis: ImportAnalysis | null,
  find: (name: string, target?: string | null) => { id: string } | null,
  muscles: Readonly<Record<string, Slug | "">>,
): string[] {
  return useMemo(() => {
    if (!analysis) return [];
    return analysis.exerciseNames.filter((name) => find(name, muscles[name] ?? null) === null);
  }, [analysis, find, muscles]);
}

// -------------------------------------------------------------------- styles

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: SPACE.lg,
  zIndex: Z_INDEX.popover,
  backgroundColor: "rgba(0, 0, 0, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  maxWidth: 640,
  maxHeight: "calc(100vh - 48px)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: SPACE.md,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.title.size,
  fontWeight: TYPE.title.weight,
  color: TEXT.primary,
};

const subtitleStyle: CSSProperties = {
  margin: `${SPACE.xs} 0 0`,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const stepsStyle: CSSProperties = {
  display: "flex",
  gap: SPACE.xs,
  listStyle: "none",
  margin: `${SPACE.lg} 0`,
  padding: 0,
};

const stepStyle: CSSProperties = {
  flex: 1,
  padding: `${SPACE.xs} ${SPACE.xs}`,
  borderBottomWidth: 2,
  borderBottomStyle: "solid",
  fontSize: TYPE.label.size,
  fontWeight: 600,
  textAlign: "center",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  marginBottom: SPACE.lg,
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: SPACE.sm,
  borderTop: `1px solid ${GLASS.border}`,
  paddingTop: SPACE.md,
};

const stackStyle: CSSProperties = { display: "grid", gap: SPACE.md };

const h3Style: CSSProperties = {
  margin: 0,
  fontSize: TYPE.body.size,
  fontWeight: 700,
  color: TEXT.primary,
};

const h4Style: CSSProperties = {
  margin: 0,
  fontSize: TYPE.label.size,
  fontWeight: 600,
  letterSpacing: TYPE.label.tracking,
  textTransform: "uppercase",
  color: TEXT.tertiary,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const successStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.sm,
  margin: 0,
  fontSize: TYPE.body.size,
  color: ACCENT.text,
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: TYPE.label.size,
  color: TEXT.tertiary,
};

const chipRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: SPACE.xs };

const mapGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: SPACE.md,
};

const selectStyle: CSSProperties = {
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: "8px 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${SOLID.borderStrong}`,
  background: SOLID.popover,
  color: TEXT.primary,
  fontSize: TYPE.body.size,
};

const fileButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: SPACE.sm,
  minHeight: MOTION.minTouchTarget,
  padding: `0 ${SPACE.lg}`,
  borderRadius: RADIUS.control,
  border: `1px solid ${SOLID.borderStrong}`,
  background: GLASS.fillRaised,
  color: TEXT.primary,
  fontSize: TYPE.body.size,
  fontWeight: 600,
  cursor: "pointer",
};

const tableWrapStyle: CSSProperties = { overflowX: "auto" };

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: TYPE.label.size,
  fontVariantNumeric: NUMERIC.align,
};

const thStyle: CSSProperties = {
  padding: "6px 10px",
  borderBottom: `1px solid ${SOLID.borderStrong}`,
  textAlign: "left",
  whiteSpace: "nowrap",
  color: TEXT.tertiary,
};

const tdStyle: CSSProperties = {
  padding: "6px 10px",
  borderBottom: `1px solid ${GLASS.border}`,
  maxWidth: 220,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: TEXT.primary,
};

const badgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${GLASS.border}`,
  fontSize: TYPE.label.size,
  fontVariantNumeric: NUMERIC.align,
  color: TEXT.secondary,
  whiteSpace: "nowrap",
};

const issueListStyle: CSSProperties = {
  display: "grid",
  gap: SPACE.xs,
  listStyle: "none",
  margin: `${SPACE.sm} 0 0`,
  padding: 0,
};

const issueRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: SPACE.sm,
  padding: `${SPACE.xs} 0`,
  borderBottom: `1px solid ${GLASS.border}`,
};

const issueMessageStyle: CSSProperties = {
  flex: 1,
  minWidth: 180,
  fontSize: TYPE.body.size,
  color: TEXT.primary,
};

const nameListStyle: CSSProperties = {
  display: "grid",
  gap: SPACE.xs,
  listStyle: "none",
  margin: `${SPACE.sm} 0 0`,
  padding: 0,
};

const nameRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.sm,
  padding: "6px 0",
  borderBottom: `1px solid ${GLASS.border}`,
  fontSize: TYPE.body.size,
  color: TEXT.primary,
};

const smallButtonStyle: CSSProperties = {
  minHeight: 32,
  padding: `0 ${SPACE.sm}`,
  borderRadius: RADIUS.sm,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.secondary,
  fontSize: TYPE.label.size,
  cursor: "pointer",
};

/** A selected chip is the accent fill; unselected ones are hairlines. */
function chipStyle(selected: boolean): CSSProperties {
  return {
    minHeight: 36,
    padding: "0 14px",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: selected ? ACCENT.base : GLASS.border,
    background: selected ? ACCENT.base : "transparent",
    color: selected ? TEXT.onAccent : TEXT.secondary,
    fontSize: TYPE.body.size,
    fontWeight: 600,
    cursor: "pointer",
  };
}