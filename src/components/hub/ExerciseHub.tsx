/**
 * ExerciseHub.tsx — one movement, everything known about it.
 *
 * The control room for an exercise, reached from the strip while a session is running. Three
 * tabs, one header, and no fourth thing to do: the athlete came here to answer a question
 * about a movement mid-set, and every element that is not that question costs them.
 *
 * Why the tab is in the URL
 * -------------------------
 * `?tab=` on this route rather than component state, because the way back has to land the
 * athlete where they left. A "back to session" that always returns to the demo tab would
 * mean someone checking their records and then having to find their way back to the set
 * they were on -- and the way back is a chip they have to find with one thumb.
 *
 * An unknown `?tab=` falls back to the first tab rather than rendering an empty panel. A
 * bookmark from a build that had four tabs should show this movement, not an error.
 *
 * What the header is for
 * ----------------------
 * The header carries the exercise's name, the session's clock, and the quick chips. See
 * `ExerciseHubHeader` for why the clock is not the session's problem and
 * `useElapsedMs` for why there is exactly one interval in the app.
 */

import { useCallback, useMemo, type CSSProperties } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useGymSettings } from "@/context/GymSettingsContext";
import { toDisplayWeight } from "@/lib/exercise/exerciseMetrics";
import { useExerciseHubData } from "@/hooks/useExerciseHubData";
import { useHubChips } from "@/hooks/useHubChips";
import { useActiveSession } from "@/context/ActiveSessionContext";
import { ExerciseHubHeader } from "./ExerciseHubHeader";
import { HubPanel, HubTabs, isHubTabId, type HubTabId } from "./HubTabs";
import { DemoTab } from "./DemoTab";
import { ProgressionTab } from "./ProgressionTab";
import { RecordsTab } from "./RecordsTab";
import { HUB_LABELS } from "@/lib/i18n";
import { GLASS, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { HOME_PATH, TRAIN_PATH } from "@/components/shell/navItems";
import type { WorkspaceOutletContext } from "@/App";

export function ExerciseHub() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const gym = useGymSettings();
  const { isActive } = useActiveSession();

  const data = useExerciseHubData(userId, exerciseId);

  const requested = searchParams.get("tab");
  const selected: HubTabId = isHubTabId(requested) ? requested : "demo";

  /*
   * `replace` rather than `push`.
   *
   * Moving between tabs writes history entries, and then the header's "back to session"
   * becomes a multi-press walk through tab changes before it reaches the workout. One
   * history entry per hub visit is the behaviour an athlete expects from a thing with tabs.
   */
  const selectTab = useCallback(
    (id: HubTabId) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (id === "demo") next.delete("tab");
          else next.set("tab", id);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const goBack = useCallback(() => {
    navigate(isActive ? TRAIN_PATH : HOME_PATH);
  }, [navigate, isActive]);

  const convert = useCallback(
    (kg: number) => toDisplayWeight(kg, gym.weightUnit),
    [gym.weightUnit],
  );

  /**
   * The one weight formatter, as a string.
   *
   * `formatWeight` takes a number because that is what `warmupSets` and the plate maths
   * produce. The unit label is appended here rather than inside a component so a chip, a
   * ramp step and a chart axis cannot end up spelling the unit three different ways.
   */
  const displayKg = useCallback(
    (kg: number) => `${toDisplayWeight(kg, gym.weightUnit)} ${gym.weightUnit}`,
    [gym.weightUnit],
  );

  const chips = useHubChips({
    sessions: data.sessions,
    unit: gym.weightUnit,
    convert,
  });

  const name = data.exercise?.name ?? "";
  const body = useMemo(() => {
    if (data.catalogError) return <Notice tone="down" text={data.catalogError} />;
    if (data.loadingExercise) return <Notice tone="neutral" text={HUB_LABELS.loading} />;
    if (!data.exercise) {
      return (
        <Notice tone="down" text={HUB_LABELS.notFound} hint={HUB_LABELS.notFoundHint} />
      );
    }

    return (
      <>
        {selected === "demo" && (
          <HubPanel id="demo">
            <DemoTab
              exercise={data.exercise}
              sessions={data.sessions}
              metrics={data.metrics}
              loading={data.loadingHistory}
              error={data.historyError}
              formatWeight={displayKg}
            />
          </HubPanel>
        )}
        {selected === "progress" && (
          <HubPanel id="progress">
            <ProgressionTab
              exercise={data.exercise}
              sessions={data.sessions}
              metrics={data.metrics}
              loading={data.loadingHistory}
              error={data.historyError}
              unit={gym.weightUnit}
              convert={convert}
            />
          </HubPanel>
        )}
        {selected === "records" && (
          <HubPanel id="records">
            <RecordsTab
              exercise={data.exercise}
              userId={userId}
              sessions={data.sessions}
              metrics={data.metrics}
              pr={data.pr}
              loading={data.loadingPr}
              unit={gym.weightUnit}
              convert={convert}
            />
          </HubPanel>
        )}
      </>
    );
  }, [
    data.catalogError,
    data.loadingExercise,
    data.exercise,
    data.sessions,
    data.metrics,
    data.historyError,
    data.loadingPr,
    data.pr,
    userId,
    gym.weightUnit,
    convert,
    displayKg,
    selected,
  ]);

  return (
    <section
      aria-label={HUB_LABELS.regionLabel(name || HUB_LABELS.loading)}
      style={screen}
    >
      <ExerciseHubHeader exerciseName={name} chips={chips} onBack={goBack} />

      {data.exercise ? <HubTabs selected={selected} onSelect={selectTab} /> : null}

      <div style={{ paddingTop: SPACE.md }}>{body}</div>
    </section>
  );
}

function Notice({
  text,
  hint,
  tone,
}: {
  text: string;
  hint?: string;
  tone: "neutral" | "down";
}) {
  return (
    <p style={{ ...noticeStyle, color: tone === "down" ? TEXT.secondary : TEXT.tertiary }}>
      {text}
      {hint ? (
        <span style={{ display: "block", marginTop: SPACE.xs, color: TEXT.disabled }}>
          {hint}
        </span>
      ) : null}
    </p>
  );
}

const screen: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
  width: "100%",
  maxWidth: "720px",
  margin: "0 auto",
};

const noticeStyle: CSSProperties = {
  margin: 0,
  padding: SPACE.md,
  borderRadius: RADIUS.card,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  fontSize: TYPE.subhead.size,
  lineHeight: TYPE.subhead.lineHeight,
};