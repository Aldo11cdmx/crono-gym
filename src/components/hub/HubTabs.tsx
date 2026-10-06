/**
 * HubTabs.tsx — the three things this screen knows about an exercise.
 *
 * `role="tablist"` with `aria-selected`, the same pattern the exercise carousel uses, for
 * the same reason: three views of one subject is a tab set, and a row of buttons that only
 * looks like one leaves a screen reader announcing three unrelated things.
 *
 * Keyboard, and it is not optional
 * --------------------------------
 * Arrow keys move between tabs and only the selected one is in the tab order (`tabindex`
 * `-1` on the rest). That is what `role="tab"` means: a screen-reader user reaches the strip
 * once and steps through it, rather than tabbing three times to hear three buttons. It also
 * makes the strip usable with one thumb, which is how this app is held.
 *
 * The tab lives in the URL, not in component state
 * -------------------------------------------------
 * `tab` is a search param on the same route. Two reasons that are not taste: the exercise
 * hub's back button has to return the athlete to the exact tab they left, and a deep link
 * into "Récords" is a thing worth having. Component state would make the third tab
 * unreachable by URL and the second tab disappear on reload.
 */

import { useCallback, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { HUB_LABELS } from "@/lib/i18n";
import { ACCENT, GLASS, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

/** The tab ids, in order. The order is the reading order of an athlete's questions. */
export const HUB_TAB_IDS = ["demo", "progress", "records"] as const;
export type HubTabId = (typeof HUB_TAB_IDS)[number];

export function isHubTabId(value: string | null | undefined): value is HubTabId {
  return HUB_TAB_IDS.includes(value as HubTabId);
}

export interface HubTabsProps {
  selected: HubTabId;
  onSelect: (id: HubTabId) => void;
}

export function HubTabs({ selected, onSelect }: HubTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Moves focus as well as selection.
   *
   * The arrow keys must land focus on the newly selected tab, not just the state. A strip
   * where the arrow changes the highlighted tab but leaves the focus behind is a strip a
   * keyboard user has to re-find their place in after every press.
   */
  const move = useCallback(
    (from: HubTabId, delta: number) => {
      const index = HUB_TAB_IDS.indexOf(from);
      // Wraps. A strip whose arrow keys stop at the ends is a strip with a dead end, and
      // the fix for that is usually a second pass of the same three tabs.
      const next = HUB_TAB_IDS[(index + delta + HUB_TAB_IDS.length) % HUB_TAB_IDS.length];
      onSelect(next);
      listRef.current?.querySelector<HTMLButtonElement>(`[data-tab='${next}']`)?.focus();
    },
    [onSelect],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(selected, 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(selected, -1);
      }
    },
    [move, selected],
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={HUB_LABELS.tabsAriaLabel}
      onKeyDown={onKeyDown}
      style={strip}
    >
      {HUB_TAB_IDS.map((id) => {
        const copy = HUB_LABELS.tabs[id];
        const isSelected = id === selected;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            data-tab={id}
            id={`hub-tab-${id}`}
            aria-selected={isSelected}
            aria-controls={`hub-panel-${id}`}
            aria-label={copy.aria}
            // Only the selected tab is reachable with Tab. See the note on arrows above.
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(id)}
            style={{ ...tabStyle, ...(isSelected ? selectedTabStyle : idleTabStyle) }}
          >
            {copy.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The panel wrapper, so the tab and its content are wired by id on both sides.
 *
 * `tabIndex={0}` on the panel: a scrollable region the keyboard can reach needs to be
 * focusable to be scrolled by a keyboard. Without it, the history table inside the
 * progression tab cannot be scrolled without a pointer.
 */
export function HubPanel({
  id,
  children,
}: {
  id: HubTabId;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`hub-panel-${id}`}
      aria-labelledby={`hub-tab-${id}`}
      tabIndex={0}
      style={{ paddingTop: SPACE.md }}
    >
      {children}
    </div>
  );
}

const strip: CSSProperties = {
  display: "flex",
  gap: SPACE.xs,
  padding: SPACE.xs,
  borderRadius: RADIUS.pill,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
  overflowX: "auto",
  scrollbarWidth: "none",
};

const tabStyle: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  minHeight: MOTION.minTouchTarget,
  padding: "0 12px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.tertiary,
  fontSize: TYPE.subhead.size,
  fontWeight: TYPE.subhead.weight,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: `background ${MOTION.fast} ${MOTION.standard}, color ${MOTION.fast} ${MOTION.standard}`,
};

/**
 * The selected tab wears the accent.
 *
 * This is the only accent on the screen. The session chip above is deliberately glass for
 * the same reason `ExerciseActions` is: the tab strip answers "where am I", and the clock
 * answers "is my session alive", and only one of those is the screen's primary position.
 * Two accents would make the athlete choose which one to believe.
 */
const selectedTabStyle: CSSProperties = {
  background: ACCENT.base,
  borderColor: ACCENT.base,
  color: TEXT.onAccent,
  fontWeight: 700,
};

const idleTabStyle: CSSProperties = {};