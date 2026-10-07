/**
 * TechniqueTips.tsx — the catalog's technique notes, and the athlete's own.
 *
 * Why an accordion and not inline steps
 * ------------------------------------------
 * The muscle map answers "what does this train" and the warm-up
 * ramp answers "where do I start"; the technique notes answer
 * "how do I do it", which the athlete asks *sometimes*. Eight
 * bulleted lines permanently below the map would push the ramp --
 * the thing this tab exists to offer -- below the fold on a phone.
 * A collapsed section keeps the answer one tap away and the ramp
 * in view.
 *
 * Why the section disappears when there are no tips
 * -------------------------------------------------------
 * An empty "Tips de técnica" with nothing under it is a heading
 * that promises a thing the catalog does not have. No tips, no
 * section: the absence has to be silent, not an error state.
 *
 * Language
 * -----------
 * The catalog seeds `exercises.instructions` from the dataset's
 * Spanish steps (`instruction_steps.es`), so the official list is
 * already the language the product speaks. There is no English
 * variant stored to fall back to, and no runtime translation:
 * what the catalog wrote is what renders.
 *
 * "Mis tips"
 * ------------
 * The athlete's own notes, kept apart from the official list and
 * deletable one by one. They live in `localStorage` per exercise
 * (`userTips.ts`), following the gym-settings reasoning: a
 * handful of strings read on first paint, per-device by design.
 *
 * Session-only accordion
 * ---------------------------
 * Open or closed is `useState`, deliberately not persisted: the
 * brief asks for it to be remembered *within* a visit and reset
 * on reload, which is exactly what component state does.
 */

import { useState, type CSSProperties, type FormEvent } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { Exercise } from "@/types/supabase";
import { HUB_DEMO_LABELS } from "@/lib/i18n";
import {
  loadUserTips,
  normaliseUserTip,
  saveUserTips,
  USER_TIPS_MAX,
} from "@/lib/exercise/userTips";
import { GLASS, MOTION, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";

/** The most official tips rendered. The catalog can carry more. */
const MAX_VISIBLE_TIPS = 8;

export interface TechniqueTipsProps {
  exercise: Exercise;
}

export function TechniqueTips({ exercise }: TechniqueTipsProps) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<string[]>(() =>
    loadUserTips(exercise.id),
  );
  const [draft, setDraft] = useState("");

  const instructions = exercise.instructions ?? [];
  // No tips, no section -- the absence is silent, not a heading
  // that promises nothing.
  if (instructions.length === 0 && mine.length === 0) return null;

  const official = instructions.slice(0, MAX_VISIBLE_TIPS);
  const hiddenCount = instructions.length - official.length;
  const regionId = `technique-tips-${exercise.id}`;

  const addMine = (e: FormEvent) => {
    e.preventDefault();
    const tip = normaliseUserTip(draft);
    if (tip === null) return;
    if (mine.includes(tip)) {
      setDraft("");
      return;
    }
    const next = [...mine, tip].slice(0, USER_TIPS_MAX);
    setMine(next);
    saveUserTips(exercise.id, next);
    setDraft("");
  };

  const removeMine = (index: number) => {
    const next = mine.filter((_, at) => at !== index);
    setMine(next);
    saveUserTips(exercise.id, next);
  };

  return (
    <section aria-label={HUB_DEMO_LABELS.tipsAriaLabel(exercise.name)} style={panel}>
      <h3 style={title}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={regionId}
          style={accordionButton}
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: `transform ${MOTION.fast} ${MOTION.standard}`,
            }}
          />
          {HUB_DEMO_LABELS.tipsTitle}
          <span style={countStyle}>
            {instructions.length > 0
              ? `${official.length}${hiddenCount > 0 ? `+${hiddenCount}` : ""}`
              : ""}
          </span>
        </button>
      </h3>

      {open ? (
        <div id={regionId} role="region" aria-label={HUB_DEMO_LABELS.tipsAriaLabel(exercise.name)} style={region}>
          {official.length > 0 ? (
            <ul
              aria-label={HUB_DEMO_LABELS.tipsOfficialAriaLabel}
              style={list}
            >
              {official.map((tip, index) => (
                <li key={`${index}-${tip.slice(0, 24)}`} style={listItem}>
                  {tip}
                </li>
              ))}
            </ul>
          ) : null}

          <div style={mineBlock}>
            <h4 style={mineTitle}>{HUB_DEMO_LABELS.tipsMine}</h4>

            {mine.length > 0 ? (
              <ul aria-label={HUB_DEMO_LABELS.tipsMineAriaLabel} style={list}>
                {mine.map((tip, index) => (
                  <li key={`${index}-${tip.slice(0, 24)}`} style={mineItem}>
                    <span style={listItem}>{tip}</span>
                    <button
                      type="button"
                      onClick={() => removeMine(index)}
                      aria-label={HUB_DEMO_LABELS.tipsMineDeleteAriaLabel(tip)}
                      style={deleteButton}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={emptyStyle}>{HUB_DEMO_LABELS.tipsMineEmpty}</p>
            )}

            <form onSubmit={addMine} style={addForm}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={280}
                placeholder={HUB_DEMO_LABELS.tipsMinePlaceholder}
                aria-label={HUB_DEMO_LABELS.tipsMinePlaceholder}
                style={input}
              />
              <button
                type="submit"
                disabled={normaliseUserTip(draft) === null}
                style={{
                  ...addButton,
                  cursor: normaliseUserTip(draft) === null ? "not-allowed" : "pointer",
                  opacity: normaliseUserTip(draft) === null ? 0.5 : 1,
                }}
              >
                <Plus size={14} aria-hidden="true" />
                {HUB_DEMO_LABELS.tipsMineAdd}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const panel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.xs,
};

const title: CSSProperties = {
  margin: 0,
};

const accordionButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: SPACE.sm,
  width: "100%",
  minHeight: MOTION.minTouchTarget,
  padding: "0 4px",
  borderRadius: RADIUS.control,
  border: "none",
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.headline.size,
  fontWeight: TYPE.headline.weight,
  cursor: "pointer",
  textAlign: "left",
};

const countStyle: CSSProperties = {
  fontSize: TYPE.caption.size,
  color: TEXT.disabled,
  fontVariantNumeric: "tabular-nums",
};

const region: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.md,
  padding: SPACE.md,
  borderRadius: RADIUS.control,
  background: GLASS.fill,
  border: `1px solid ${GLASS.border}`,
};

/** 15/24: the brief's reading size for a short tips list. */
const list: CSSProperties = {
  margin: 0,
  padding: "0 0 0 20px",
  display: "flex",
  flexDirection: "column",
  gap: SPACE.xs,
};

const listItem: CSSProperties = {
  margin: 0,
  fontSize: TYPE.subhead.size,
  lineHeight: TYPE.body.lineHeight,
  color: TEXT.secondary,
};

const mineBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
};

const mineTitle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
  color: TEXT.disabled,
};

const mineItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.sm,
  listStyle: "none",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  color: TEXT.tertiary,
};

const addForm: CSSProperties = {
  display: "flex",
  gap: SPACE.sm,
};

const input: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: MOTION.minTouchTarget,
  padding: "8px 10px",
  borderRadius: RADIUS.input,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.body.size,
  lineHeight: TYPE.body.lineHeight,
  fontFamily: "inherit",
};

const addButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  minHeight: MOTION.minTouchTarget,
  padding: "0 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.borderStrong}`,
  background: GLASS.fillRaised,
  color: TEXT.primary,
  fontSize: TYPE.caption.size,
  fontWeight: TYPE.label.weight,
};

const deleteButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: MOTION.minTouchTarget,
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.control,
  border: "none",
  background: "transparent",
  color: TEXT.tertiary,
  cursor: "pointer",
  flexShrink: 0,
};
