/**
 * @vitest-environment jsdom
 *
 * SetNoteField.test.tsx — the per-set note's interaction contract:
 * one discreet glyph, an inline field, a debounced save that never
 * blocks the set's own editing, and a close that hands focus back.
 *
 * Time is faked, because the debounce is the interesting part: a note
 * should be saved shortly after the athlete stops typing, not on every
 * keystroke, and a draft younger than the debounce must survive an
 * unmount rather than vanishing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
} from "@testing-library/react";

import { SET_NOTES } from "@/lib/workout/setNotes";
import { SetNoteField, type SetNoteFieldProps } from "./SetNoteField";

const OPEN_LABEL = "Nota de la serie 1";
const TEXT_LABEL = "Texto de la nota de la serie 1";

function setup(props: Partial<SetNoteFieldProps> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <SetNoteField index={0} note={null} onChange={onChange} {...props} />,
  );
  return { onChange, ...utils };
}

function openField(utils: ReturnType<typeof setup>) {
  fireEvent.click(utils.getByLabelText(OPEN_LABEL));
  return utils.getByLabelText(TEXT_LABEL) as HTMLTextAreaElement;
}

describe("SetNoteField", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts as one discreet icon, not a permanent input", () => {
    const { container, getByLabelText } = setup();
    // The glyph is the whole UI until asked for: the set table's numbers
    // stay in view.
    expect(container.querySelector("textarea")).toBeNull();
    expect(getByLabelText(OPEN_LABEL)).toBeTruthy();
    expect(getByLabelText(OPEN_LABEL).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("opens the field on tap and expands the aria state", () => {
    const { getByLabelText } = setup();
    fireEvent.click(getByLabelText(OPEN_LABEL));
    expect(getByLabelText(TEXT_LABEL)).toBeTruthy();
    expect(getByLabelText(OPEN_LABEL).getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("saves on the debounce, not per keystroke", () => {
    const field = setup();
    const textarea = openField(field);

    fireEvent.change(textarea, { target: { value: "rodilla" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(field.onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(field.onChange).toHaveBeenCalledTimes(1);
    expect(field.onChange).toHaveBeenCalledWith("rodilla");
  });

  it("restarts the debounce while the athlete is still typing", () => {
    const field = setup();
    const textarea = openField(field);

    fireEvent.change(textarea, { target: { value: "ro" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.change(textarea, { target: { value: "rodilla" } });
    // 300 ms after the second keystroke: still not saved.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(field.onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(field.onChange).toHaveBeenCalledTimes(1);
    expect(field.onChange).toHaveBeenCalledWith("rodilla");
  });

  it("saves immediately when the field closes by Esc", () => {
    const field = setup();
    const textarea = openField(field);

    fireEvent.change(textarea, { target: { value: "agarre ancho" } });
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(field.onChange).toHaveBeenCalledTimes(1);
    expect(field.onChange).toHaveBeenCalledWith("agarre ancho");
    // The card unmounts; the icon remains.
    expect(
      document.querySelector('div[role="group"][aria-label="Nota de la serie 1"]'),
    ).toBeNull();
  });

  it("saves immediately when the field loses focus", () => {
    const field = setup();
    const textarea = openField(field);

    fireEvent.change(textarea, { target: { value: "sin spotter" } });
    fireEvent.blur(textarea);
    expect(field.onChange).toHaveBeenCalledTimes(1);
    expect(field.onChange).toHaveBeenCalledWith("sin spotter");
  });

  it("saves null, never an empty string, when the field is cleared", () => {
    const field = setup({ note: "vieja nota" });
    const textarea = openField(field);

    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.blur(textarea);
    expect(field.onChange).toHaveBeenCalledWith(null);
  });

  it("opens holding the saved note, so it is edited not retyped", () => {
    const field = setup({ note: "ya escrita" });
    const textarea = openField(field);
    expect(textarea.value).toBe("ya escrita");
  });

  it("reminds the athlete of the previous session's note, read-only", () => {
    const field = setup({
      previousNote: "la última vez fue fácil",
    });
    openField(field);
    // Only while the field is open and empty: a reminder, not a second
    // editor.
    expect(field.getByText("la última vez fue fácil")).toBeTruthy();
  });

  it("appends a quick chip without replacing what was typed", () => {
    const field = setup();
    const textarea = openField(field);

    fireEvent.change(textarea, { target: { value: "rodilla" } });
    fireEvent.click(field.getByRole("button", { name: "Técnica" }));
    fireEvent.blur(textarea);
    expect(field.onChange).toHaveBeenCalledWith("rodilla Técnica");
  });

  it("does not add the same chip twice", () => {
    const field = setup();
    const textarea = openField(field);

    fireEvent.click(field.getByRole("button", { name: "Técnica" }));
    fireEvent.click(field.getByRole("button", { name: "Técnica" }));
    fireEvent.blur(textarea);
    expect(field.onChange).toHaveBeenCalledWith("Técnica");
  });

  it("clamps a paste that bypassed the maxLength attribute", () => {
    const field = setup();
    const textarea = openField(field);

    const tooLong = "a".repeat(SET_NOTES.MAX_LENGTH + 40);
    fireEvent.change(textarea, { target: { value: tooLong } });
    fireEvent.blur(textarea);
    expect(field.onChange).toHaveBeenCalledWith("a".repeat(SET_NOTES.MAX_LENGTH));
  });

  it("counts characters against the bound", () => {
    const field = setup();
    const textarea = openField(field);

    fireEvent.change(textarea, { target: { value: "abc" } });
    expect(field.getByText(`3/${SET_NOTES.MAX_LENGTH}`)).toBeTruthy();
  });

  it("keeps a draft younger than the debounce across an unmount", () => {
    // Switching exercise unmounts the field; the session draft's autosave
    // is debounced too, so this flush is the note's only chance to exist.
    const onChange = vi.fn();
    const { container, unmount } = render(
      <SetNoteField index={0} note={null} onChange={onChange} />,
    );
    const icon = container.querySelector("button")!;
    act(() => {
      fireEvent.click(icon);
    });
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "borrador" } });
    unmount();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("borrador");
  });

  it("saves the literal string for angle brackets, because React escapes it", () => {
    // No dangerouslySetInnerHTML anywhere: an angle bracket in a note is a
    // character the athlete typed, not markup.
    const field = setup();
    const textarea = openField(field);

    const markup = "<b>not markup</b>";
    fireEvent.change(textarea, { target: { value: markup } });
    fireEvent.blur(textarea);
    expect(field.onChange).toHaveBeenCalledWith(markup);
  });

  it("labels the icon with its own set number", () => {
    const first = setup();
    const second = setup({ index: 1 });
    expect(first.getByLabelText("Nota de la serie 1")).toBeTruthy();
    expect(second.getByLabelText("Nota de la serie 2")).toBeTruthy();
  });
});
