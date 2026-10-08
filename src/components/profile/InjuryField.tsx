/**
 * InjuryField.tsx — the free-text injury note.
 *
 * The injury note is the one field that reaches a prompt, and it is the one
 * place where injection matters. This component owns the local draft and the
 * character counter; the caller owns the save. The chips below the textarea
 * *add* text (with a separator) rather than replacing it, so a user can name
 * multiple areas without losing what they already typed.
 */

import { useEffect, useRef, useState } from "react";
import { ACCENT, GLASS, MOTION, RADIUS, SPACE, SOLID, TEXT, TYPE } from "@/design/tokens";
import { sanitizeFreeText, INJURY_MAX_CHARS } from "@/lib/profile/validation";
import { PROFILE_LABELS } from "@/lib/i18n";

export interface InjuryFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

const QUICK_CHIPS = PROFILE_LABELS.contextInjuryQuick as readonly string[];

/**
 * A textarea with a live character counter and quick-access chips.
 *
 * The counter is `n/200` and turns red at the cap, which is the only feedback
 * the user needs: there is nothing else wrong with a long note, the cap is
 * a prompt constraint, not a validation error.
 */
export function InjuryField({ value, onChange, disabled }: InjuryFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  // Keep the local draft in sync when the parent clears the field.
  useEffect(() => {
    if (textareaRef.current && document.activeElement !== textareaRef.current) {
      textareaRef.current.value = value;
    }
  }, [value]);

  const insertChip = (chip: string) => {
    const current = textareaRef.current?.value ?? value;
    const next = current.trim().length > 0 ? `${current}, ${chip}` : chip;
    textareaRef.current!.value = next;
    onChange(sanitizeFreeText(next));
    textareaRef.current?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
      <label style={{ fontSize: TYPE.label.size, color: TEXT.tertiary }}>
        {PROFILE_LABELS.contextInjury}
      </label>
      <textarea
        ref={textareaRef}
        defaultValue={value}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(sanitizeFreeText(e.target.value))}
        aria-describedby="injury-counter"
        rows={2}
        style={{
          width: "100%",
          minHeight: MOTION.minTouchTarget,
          padding: "8px 12px",
          borderRadius: RADIUS.control,
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: focused ? ACCENT.base : SOLID.borderStrong,
          background: "transparent",
          color: TEXT.primary,
          fontSize: TYPE.body.size,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      <div
        id="injury-counter"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: TYPE.caption.size, color: TEXT.tertiary }}
      >
        <span>{PROFILE_LABELS.contextInjuryHint}</span>
        <span style={{ color: value.length >= INJURY_MAX_CHARS ? ACCENT.text : undefined }}>
          {PROFILE_LABELS.contextInjuryChars(value.length)}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={disabled}
            onClick={() => insertChip(chip)}
            style={{
              minHeight: 32,
              padding: `0 ${SPACE.sm}`,
              borderRadius: RADIUS.pill,
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: GLASS.borderStrong,
              background: "transparent",
              color: TEXT.secondary,
              fontSize: TYPE.caption.size,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.45 : 1,
            }}
          >
            + {chip}
          </button>
        ))}
      </div>
    </div>
  );
}