/**
 * SetNoteField.tsx — the per-set note: one discreet icon, one inline field.
 *
 * Why an icon and not an always-visible input
 * ------------------------------------------------
 * Four rows of four boxes is already the set table; a fifth permanent
 * text box per row would push the weight and reps -- the numbers the
 * athlete is actually mid-entry on -- below the fold. The note is
 * secondary by design, so it lives behind a 20 px glyph with a 44 px
 * tap target until it is asked for.
 *
 * Why the icon changes when a note exists
 * -------------------------------------------
 * A set with a note has to show it without opening anything: the athlete
 * scanning the row for "did I write something about this set" gets the
 * answer from the filled glyph and the dot, the same way a completed row
 * reads green without being clicked -- two signals, so the state survives
 * being read without colour alone.
 *
 * Saving
 * --------
 * The field owns a draft and saves it on a debounce and on close, so a
 * note is never lost to a stray tap elsewhere -- but it is also never
 * urgent: a note is an accessory to a set, never a condition of one, and
 * nothing here blocks, delays or rewrites the set's own `onChange`. The
 * payload it emits is already normalised (`setNotes.ts`), so a cleared
 * field saves `null` rather than an empty string, and an over-long paste
 * is clamped rather than rejected mid-thought.
 *
 * Plain text, by construction
 * -------------------------------
 * React escapes everything this component renders; there is deliberately
 * no `dangerouslySetInnerHTML` anywhere, so an angle bracket in a note is
 * a character the athlete typed, not markup.
 */

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { StickyNote } from "lucide-react";
import {
  appendNoteChip,
  normaliseSetNote,
  SET_NOTES,
} from "@/lib/workout/setNotes";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SPACE,
  TEXT,
  TYPE,
} from "@/design/tokens";

export interface SetNoteFieldProps {
  /** Zero-based set index; the label says `index + 1`. */
  index: number;
  /** The saved note, or null. */
  note: string | null;
  /**
   * The same set's note from the previous session, read-only.
   * Shown as a grey reminder while the field is open and empty.
   */
  previousNote?: string | null;
  /**
   * Saves a normalised note. Called with `null` when the field is
   * emptied -- never with `""`.
   */
  onChange: (note: string | null) => void;
}

/** The debounce before a draft becomes a saved note. */
const SAVE_DEBOUNCE_MS = 400;

export function SetNoteField({
  index,
  note,
  previousNote,
  onChange,
}: SetNoteFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  // The draft and the pending save travel in refs so the unmount flush
  // and the debounced save never disagree about which text is theirs.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const hasNote = note !== null && note !== undefined && note.length > 0;

  /**
   * Writes the current draft through the normaliser.
   *
   * Idempotent by construction: normalising an unchanged draft yields the
   * same note, and the parent's `onChange` is cheap enough that calling it
   * with an identical value is a no-op re-render, not a duplicate write.
   */
  const flush = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    onChange(normaliseSetNote(draftRef.current));
  };

  // Debounce: a draft becomes a note ~400 ms after the athlete stops
  // typing, so typing is never chatty and the autosave of the session
  // draft (also debounced) sees one write, not one per keystroke.
  useEffect(() => {
    if (!open || !dirtyRef.current) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
    // `flush` reads refs only, and this effect re-runs exactly when the
    // draft or the open state changes -- the two things that can make a
    // pending save stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, open]);

  /**
   * Never lose text to an unmount.
   *
   * Switching exercise or navigating to the hub unmounts this field; a
   * draft younger than the debounce would otherwise vanish. The flush is
   * the same normalised write the debounce would have made.
   */
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        onChange(normaliseSetNote(draftRef.current));
        dirtyRef.current = false;
      }
    };
    // Runs once, on mount: the refs it reads are the live ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openField = () => {
    setOpen(true);
    // The field opens already holding the saved note, so the athlete edits
    // what is there rather than retyping it.
    setDraft(note ?? "");
    dirtyRef.current = false;
    // Focus after the field exists: the paint has to lay it out first.
    requestAnimationFrame(() => {
      fieldRef.current?.focus();
    });
  };

  const closeField = (restoreFocus: boolean) => {
    flush();
    setOpen(false);
    if (restoreFocus) {
      // Esc or the toggle returns the athlete to the glyph they opened,
      // so the row's control order is not lost.
      buttonRef.current?.focus();
    }
  };

  const handleDraft = (value: string) => {
    setDraft(value);
    dirtyRef.current = true;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeField(true);
    }
  };

  return (
    <div style={wrapper}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeField(true) : openField())}
        aria-label={`Nota de la serie ${index + 1}`}
        aria-expanded={open}
        title={`Nota de la serie ${index + 1}`}
        style={{
          ...iconButton,
          // The filled glyph is the indicator: a set with a note wears the
          // accent, an empty one stays quiet.
          color: hasNote ? ACCENT.text : TEXT.tertiary,
        }}
      >
        <StickyNote
          size={20}
          aria-hidden="true"
          fill={hasNote ? "currentColor" : "none"}
          strokeWidth={hasNote ? 0 : 2}
        />
        {hasNote ? <span style={dot} aria-hidden="true" /> : null}
      </button>

      {open ? (
        <div style={fieldCard} role="group" aria-label={`Editor de la nota de la serie ${index + 1}`}>
          {previousNote && !hasNote && draft.trim().length === 0 ? (
            <p style={previousStyle}>
              <span style={previousLabel}>Última vez: </span>
              {previousNote}
            </p>
          ) : null}

          <textarea
            ref={fieldRef}
            value={draft}
            onChange={(e) => handleDraft(e.target.value)}
            onBlur={() => closeField(false)}
            onKeyDown={handleKeyDown}
            maxLength={SET_NOTES.MAX_LENGTH}
            rows={2}
            aria-label={`Texto de la nota de la serie ${index + 1}`}
            placeholder="¿Algo que recordar de esta serie?"
            style={textarea}
          />

          <div style={fieldFooter}>
            <div style={chips} role="group" aria-label="Añadir etiqueta rápida">
              {SET_NOTES.QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleDraft(appendNoteChip(draft, chip))}
                  style={chipButton}
                >
                  {chip}
                </button>
              ))}
            </div>
            <span style={counter} aria-hidden="true">
              {draft.length}/{SET_NOTES.MAX_LENGTH}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const wrapper: CSSProperties = {
  position: "relative",
  display: "inline-flex",
};

const iconButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  minWidth: MOTION.minTouchTarget,
  minHeight: MOTION.minTouchTarget,
  borderRadius: RADIUS.control,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  cursor: "pointer",
};

/** The second, non-colour signal that a set carries a note. */
const dot: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: ACCENT.base,
};

const fieldCard: CSSProperties = {
  position: "absolute",
  top: `calc(${MOTION.minTouchTarget} + ${SPACE.xs})`,
  right: 0,
  zIndex: 10,
  width: 280,
  maxWidth: "82vw",
  display: "flex",
  flexDirection: "column",
  gap: SPACE.xs,
  padding: SPACE.md,
  borderRadius: RADIUS.control,
  background: GLASS.fillRaised,
  border: `1px solid ${GLASS.borderStrong}`,
  boxShadow: GLASS.shadow,
};

const previousStyle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  color: TEXT.disabled,
};

const previousLabel: CSSProperties = {
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.tracking,
};

const textarea: CSSProperties = {
  width: "100%",
  resize: "vertical",
  minHeight: 48,
  padding: "8px 10px",
  borderRadius: RADIUS.input,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.primary,
  fontSize: TYPE.body.size,
  lineHeight: TYPE.body.lineHeight,
  fontFamily: "inherit",
};

const fieldFooter: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: SPACE.sm,
};

const chips: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "4px",
};

const chipButton: CSSProperties = {
  minHeight: "28px",
  padding: "0 8px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${GLASS.border}`,
  background: "transparent",
  color: TEXT.secondary,
  fontSize: TYPE.caption.size,
  cursor: "pointer",
};

const counter: CSSProperties = {
  fontSize: TYPE.caption.size,
  color: TEXT.disabled,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};
