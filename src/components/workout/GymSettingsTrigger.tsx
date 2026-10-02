/**
 * GymSettingsTrigger.tsx — the gear that opens the gym settings, wherever it sits.
 *
 * One component rather than a gear button per screen, because the panel is only
 * useful from somewhere the user is already choosing weights: the stepper reads
 * the bar and the plate rack on every keystroke, so a gym whose inventory is
 * wrong is a gym that suggests impossible loads. A profile page is a reasonable
 * second home for it, but a *second* button means a second piece of open-state
 * bookkeeping, and the usual failure is a modal whose close handler is wired to
 * the wrong screen.
 *
 * So the button owns the state, the panel and the overlay, and a host only has to
 * say where it is. That is why this is one component and not an exported
 * `useGymSettingsModal` hook: there is nothing left for the caller to get wrong.
 *
 * The trigger keeps its own focus when the modal closes, because
 * `GymSettingsModal` deliberately has no focus trap -- a keyboard user who opens
 * the settings and closes them lands back on the gear rather than at the top of
 * the document.
 */

import { useCallback, useState, type CSSProperties } from "react";
import { Settings2 } from "lucide-react";
import { GYM_LABELS } from "@/lib/i18n";
import { GLASS, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { GymSettingsModal } from "./GymSettingsModal";

export interface GymSettingsTriggerProps {
  /**
   * Names the screen the gear is on, for the accessible name.
   *
   * Defaults to the logger because that is where the settings matter most and
   * the first host; a host on another screen should pass its own so the button
   * is not announced identically in two places.
   */
  context?: string;
  /** Extra styles, for hosts that size the button themselves. */
  style?: CSSProperties;
  className?: string;
}

export function GymSettingsTrigger({
  context = GYM_LABELS.defaultTriggerContext,
  style,
  className,
}: GymSettingsTriggerProps = {}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={GYM_LABELS.triggerAriaLabel(context)}
        title={GYM_LABELS.triggerTitle}
        className={className}
        style={style ? { ...triggerStyle, ...style } : triggerStyle}
      >
        <Settings2 size={16} aria-hidden="true" />
      </button>

      {open && <GymSettingsModal onClose={close} />}
    </>
  );
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: MOTION.minTouchTarget,
  height: MOTION.minTouchTarget,
  padding: 0,
  gap: SPACE.xs,
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: GLASS.fillRaised,
  color: TEXT.secondary,
  cursor: "pointer",
  transition: `background-color ${MOTION.fast} ${MOTION.ease}, color ${MOTION.fast} ${MOTION.ease}`,
  fontSize: TYPE.label.size,
};
