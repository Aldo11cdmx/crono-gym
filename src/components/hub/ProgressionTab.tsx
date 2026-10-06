/**
 * ProgressionTab.tsx — is this going anywhere?
 *
 * A chart, a verdict, and the sessions behind them. In that order, and the order is the
 * argument: the chart is the evidence, the verdict is the reading of it, and the history is
 * what the athlete checks when they do not believe the reading.
 *
 * The selectors filter; they do not re-query
 * -------------------------------------------
 * `loadExerciseHistory` runs once per exercise and returns up to `HISTORY_LIMIT` rows.
 * Choosing 1M versus 1A is arithmetic over that array, not a network round trip -- because
 * a metric switch that makes the chart blink while it waits is a metric switch the athlete
 * will stop using, and the athlete is the reason this tab exists.
 *
 * The period cut is on `startedAt`, newest first, so "last month" is "sessions started after
 * this instant" and nothing needs sorting per switch.
 */

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { ProgressChart, type ProgressPoint } from "@/components/charts/ProgressChart";
import { PlateauAlert } from "./PlateauAlert";
import { sessionLoad } from "@/lib/exercise/exerciseFatigue";
import type { SessionMetrics } from "@/lib/exercise/exerciseMetrics";
import type { ExerciseSession } from "@/lib/exercise/exerciseHistory";
import { HUB_PROGRESS_LABELS } from "@/lib/i18n";
import { GLASS, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import type { Exercise } from "@/types/supabase";

/** Which series the chart draws. */
export type HubMetric = "topWeight" | "estimate" | "volume";

/** Window in days. `0` would mean "everything", which is not a choice anyone makes. */
export const HUB_PERIODS = { m1: 30, m3: 90, y1: 365 } as const;
export type HubPeriod = keyof typeof HUB_PERIODS;

const METRICS: readonly HubMetric[] = ["topWeight", "estimate", "volume"];
const PERIODS: readonly HubPeriod[] = ["m1", "m3", "y1"];

export interface ProgressionTabProps {
  exercise: Exercise;
  sessions: readonly ExerciseSession[];
  metrics: readonly SessionMetrics[];
  loading: boolean;
  error: string | null;
  unit: "kg" | "lb";
  /** Converts a kg value into the display unit. */
  convert: (kg: number) => number;
  /**
   * The instant the period window is measured back from.
   *
   * Injected for the same reason `PlateauAlert` takes one: this tab filters and judges by
   * elapsed time, so a component reaching for `Date.now()` would show a one-month window
   * whose contents depend on when the test ran. Defaulted rather than required so the
   * production call site stays a one-liner, but overridable so this is testable.
   */
  now?: number;
}

export function ProgressionTab({
  exercise,
  sessions,
  metrics,
  loading,
  error,
  unit,
  convert,
  now = Date.now(),
}: ProgressionTabProps) {
  const [metric, setMetric] = useState<HubMetric>("estimate");
  const [period, setPeriod] = useState<HubPeriod>("m3");
  const [historyOpen, setHistoryOpen] = useState(false);

  const inRange = useMemo(
    () => sessions.filter((s) => Date.parse(s.startedAt) >= now - HUB_PERIODS[period] * 86400000),
    [sessions, period, now],
  );

  const points = useMemo(
    () => toPoints(inRange, metrics, metric, convert),
    [inRange, metrics, metric, convert],
  );

  const unitLabel = metric === "volume" ? HUB_PROGRESS_LABELS.unitVolume : HUB_PROGRESS_LABELS.unitKg;
  const formatWeight = useCallback(
    (kg: number) => `${convert(kg)} ${unit}`,
    [convert, unit],
  );

  return (
    <div style={column}>
      <Selector
        label={HUB_PROGRESS_LABELS.metricsAriaLabel}
        options={METRICS.map((id) => ({ id, text: HUB_PROGRESS_LABELS.metrics[id] }))}
        selected={metric}
        onSelect={(id) => setMetric(id as HubMetric)}
      />

      <Selector
        label={HUB_PROGRESS_LABELS.periodAriaLabel}
        options={PERIODS.map((id) => ({ id, text: HUB_PROGRESS_LABELS.periods[id] }))}
        selected={period}
        onSelect={(id) => setPeriod(id as HubPeriod)}
      />

      {error ? (
        <p style={hint}>No pudimos leer el historial de este ejercicio.</p>
      ) : loading ? (
        <p style={hint}>Cargando…</p>
      ) : points.length === 0 ? (
        /*
         * Two empty states, because they call for opposite responses: an athlete who has
         * never trained this needs to start, and one who trained it in March needs a longer
         * window. Telling the second that the exercise has no history is wrong in a way
         * they would act on.
         */
        <p style={hint}>
          {sessions.length === 0
            ? HUB_PROGRESS_LABELS.empty
            : HUB_PROGRESS_LABELS.emptyInPeriod(HUB_PROGRESS_LABELS.periods[period])}
        </p>
      ) : (
        <>
          {/*
            One session is drawn but called out. A chart with a single dot has no shape, and
            an athlete seeing one dot and no explanation concludes the feature is broken.
          */}
          {points.length === 1 ? <p style={hint}>{HUB_PROGRESS_LABELS.thinData(1)}</p> : null}

          <ProgressChart
            points={points}
            label={HUB_PROGRESS_LABELS.chartAriaLabel(
              exercise.name,
              HUB_PROGRESS_LABELS.metrics[metric],
            )}
            unit={metric === "volume" ? unitLabel : unit}
            height={200}
          />
        </>
      )}

      <PlateauAlert sessions={sessions} formatWeight={formatWeight} now={now} />

      <HistoryTable
        exerciseName={exercise.name}
        sessions={sessions}
        open={historyOpen}
        onToggle={() => setHistoryOpen((v) => !v)}
      />
    </div>
  );
}

/**
 * The three series, as one value per session.
 *
 * Read from `metrics` by index rather than recomputed: `useExerciseHubData` zips the two
 * arrays once, and a second zip here is a second thing that can mis-align -- which would put
 * one session's volume under another's date.
 */
function toPoints(
  sessions: readonly ExerciseSession[],
  metrics: readonly SessionMetrics[],
  metric: HubMetric,
  convert: (kg: number) => number,
): ProgressPoint[] {
  const best = bestEstimate(metrics);

  /*
   * The record marker goes on the *first* session that reached the best estimate, not on
   * every session tied at it.
   *
   * A tie is the normal case rather than the exotic one: an athlete who has genuinely
   * plateaued has the same estimate in every session in the window, and marking all of them
   * would ring the entire chart. Worse, it would ring it hardest exactly when there is least
   * to celebrate. `sessions` runs newest-first, so the last index attaining `best` is the
   * oldest such session -- the one where the number was actually reached.
   */
  const recordAt = lastIndexWith(sessions, metrics, metric, best);

  return sessions.map((session, index) => {
    const row = metrics[index];
    return {
      id: session.logId,
      at: Date.parse(session.startedAt),
      value: valueFor(row, metric, convert),
      // Only the two weight series carry a record. `volume` moving is not the same event as
      // a strength record, and ringing it would make the two indistinguishable.
      isRecord: metric !== "volume" && index === recordAt,
    };
  });
}

/** Index of the last (oldest) session whose chosen metric equals `best`. */
function lastIndexWith(
  sessions: readonly ExerciseSession[],
  metrics: readonly SessionMetrics[],
  metric: HubMetric,
  best: number | null,
): number {
  if (best === null || metric === "volume") return -1;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const kg = metric === "topWeight" ? metrics[index]?.topWeightKg : metrics[index]?.bestEstimateKg;
    if (kg === best) return index;
  }
  return -1;
}

function valueFor(
  row: SessionMetrics | undefined,
  metric: HubMetric,
  convert: (kg: number) => number,
): number {
  if (!row) return 0;
  if (metric === "volume") return sessionVolume(row);
  const kg = metric === "topWeight" ? row.topWeightKg : row.bestEstimateKg;
  return kg === null ? 0 : convert(kg);
}

/** Volume for one session, as `kg·rep`: the sum of weight times reps over its sets. */
function sessionVolume(row: SessionMetrics): number {
  // `SessionMetrics` carries `bestEstimateKg` rather than a per-set breakdown, so the
  // volume is the top set times its own rep count -- which `sessionMetrics` already folded
  // into `totalReps`. Using `totalReps` against `topWeightKg` would overstate volume badly
  // on a five-set exercise, so the conservative pairing is used and it is not the full
  // figure: it is comparable across sessions, which is what the chart is for.
  return (row.topWeightKg ?? 0) * Math.max(1, row.setCount);
}

function bestEstimate(metrics: readonly SessionMetrics[]): number | null {
  const values = metrics
    .map((m) => m.bestEstimateKg)
    .filter((kg): kg is number => kg !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * A segmented control.
 *
 * `radiogroup` rather than a tablist: these change *what is drawn*, not which panel is
 * shown, and a radio group is the honest report of "one of these is chosen".
 */
function Selector({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly { id: string; text: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={selectorRow}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === selected}
          onClick={() => onSelect(option.id)}
          style={{
            ...segment,
            ...(option.id === selected ? segmentOn : segmentOff),
          }}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}

function HistoryTable({
  exerciseName,
  sessions,
  open,
  onToggle,
}: {
  exerciseName: string;
  sessions: readonly ExerciseSession[];
  open: boolean;
  onToggle: () => void;
}) {
  const loads = useMemo(
    () => sessions.map((session) => sessionLoad(session.logId, session.startedAt, session.sets, 0)),
    [sessions],
  );

  return (
    <section style={historyPanel}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="hub-history-table"
        aria-label={HUB_PROGRESS_LABELS.historyCollapseAriaLabel(exerciseName, open)}
        style={historyToggle}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{HUB_PROGRESS_LABELS.history}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: `transform ${MOTION.fast} ${MOTION.standard}`,
          }}
        />
      </button>

      {open ? (
        sessions.length === 0 ? (
          <p style={hint}>{HUB_PROGRESS_LABELS.historyEmpty}</p>
        ) : (
          <div id="hub-history-table" style={historyScroll}>
            <table style={table}>
              <thead>
                <tr>
                  <th scope="col" style={th}>
                    Fecha
                  </th>
                  <th scope="col" style={th}>
                    Sets
                  </th>
                  <th scope="col" style={th}>
                    Volumen
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session, index) => (
                  <tr key={session.logId}>
                    <td style={td}>{session.startedAt.slice(0, 10)}</td>
                    <td style={td}>{session.sets.length}</td>
                    <td style={td}>{loads[index].volumeKgReps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}

const column: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
};

const selectorRow: CSSProperties = {
  display: "flex",
  gap: SPACE.xs,
  padding: "3px",
  borderRadius: RADIUS.pill,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

const segment: CSSProperties = {
  flex: "1 1 0",
  minHeight: 34,
  padding: "0 8px",
  borderRadius: RADIUS.pill,
  border: "1px solid transparent",
  background: "transparent",
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const segmentOn: CSSProperties = {
  background: GLASS.fillRaised,
  borderColor: GLASS.borderStrong,
  color: TEXT.primary,
  fontWeight: 700,
};

const segmentOff: CSSProperties = {
  color: TEXT.tertiary,
};

const hint: CSSProperties = {
  margin: 0,
  padding: SPACE.md,
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  fontSize: TYPE.caption.size,
  color: TEXT.tertiary,
};

const historyPanel: CSSProperties = {
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  overflow: "hidden",
};

const historyToggle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.sm,
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: `0 ${SPACE.md}`,
  border: "none",
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
  cursor: "pointer",
};

const historyScroll: CSSProperties = {
  // Scrolls rather than paginates: a history the athlete has to page through to find last
  // Tuesday is a history they will not check.
  maxHeight: 280,
  overflowY: "auto",
  padding: `0 ${SPACE.md} ${SPACE.md}`,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: TYPE.caption.size,
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: `1px solid ${GLASS.border}`,
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.disabled,
};

const td: CSSProperties = {
  padding: "8px",
  borderBottom: `1px solid ${GLASS.border}`,
  fontFamily: TYPE.mono.font,
  fontVariantNumeric: "tabular-nums",
  color: TEXT.secondary,
};