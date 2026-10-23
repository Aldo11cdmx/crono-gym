/**
 * @vitest-environment jsdom
 *
 * TechniqueTips.test.tsx — the technique accordion: collapsed by
 * default so the warm-up ramp stays in view, capped at eight official
 * tips, and keeping the athlete's own tips apart from the catalog's,
 * with per-tip delete and localStorage persistence.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Exercise } from "@/types/supabase";
import { USER_TIPS_PREFIX } from "@/lib/exercise/userTips";
import { TechniqueTips } from "./TechniqueTips";

function exercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: "bench",
    name: "Press de banca",
    body_part: "chest",
    target: "pectorals",
    equipment: "barbell",
    gif_url: "",
    instructions: ["Baja la barra al pecho", "Empuja hasta arriba"],
    ...over,
  } as Exercise;
}

const TIPS_KEY = USER_TIPS_PREFIX + "bench";

function renderTips(props: Partial<Exercise> = {}) {
  return render(<TechniqueTips exercise={exercise(props)} />);
}

describe("TechniqueTips", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when the catalog has no tips and none are saved", () => {
    // An empty "Tips de técnica" is a heading that promises a thing the
    // catalog does not have. No tips, no section.
    const { container } = renderTips({ instructions: [] });
    expect(container.firstChild).toBeNull();
  });

  it("still renders when only the athlete's own tips exist", () => {
    window.localStorage.setItem(TIPS_KEY, JSON.stringify(["mi tip"]));
    const { container } = renderTips({ instructions: [] });
    expect(container.firstChild).not.toBeNull();
  });

  it("starts collapsed, so the ramp above stays in view", () => {
    const { getByRole } = renderTips();
    const button = getByRole("button", { name: /Tips de técnica/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands on tap with the accordion ARIA wiring", () => {
    const { getByRole } = renderTips();
    const button = getByRole("button", { name: /Tips de técnica/ });
    const regionId = button.getAttribute("aria-controls")!;

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    const region = document.getElementById(regionId);
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("region");
  });

  it("lists the catalog's steps when expanded", () => {
    const { getByRole, getByText } = renderTips();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));

    expect(getByText("Baja la barra al pecho")).toBeTruthy();
    expect(getByText("Empuja hasta arriba")).toBeTruthy();
  });

  it("caps the official list at eight, because a longer list stops being read", () => {
    const many = Array.from({ length: 10 }, (_, i) => `Paso ${i + 1}`);
    const { getByRole, queryByText } = renderTips({ instructions: many });
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));

    expect(queryByText("Paso 8")).not.toBeNull();
    expect(queryByText("Paso 9")).toBeNull();
  });

  it("shows the official count in the header", () => {
    const { getByRole, getByText } = renderTips();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));
    expect(getByText("2")).toBeTruthy();
  });

  it("keeps the athlete's tips apart, with their own heading", () => {
    window.localStorage.setItem(TIPS_KEY, JSON.stringify(["mi tip"]));
    const { getByText, getByRole } = renderTips();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));

    expect(getByText("Mis tips")).toBeTruthy();
    expect(getByText("mi tip")).toBeTruthy();
  });

  it("says so when there are no personal tips yet", () => {
    const { getByText, getByRole } = renderTips();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));
    expect(
      getByText("Aún no tienes tips propios para este ejercicio."),
    ).toBeTruthy();
  });

  it("adds a personal tip and persists it", () => {
    const { getByRole, getByPlaceholderText, getByText } = renderTips();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));

    fireEvent.change(getByPlaceholderText("Añade tu propio tip…"), {
      target: { value: "agarre más cerrado" },
    });
    fireEvent.click(getByRole("button", { name: "Guardar tip" }));

    expect(getByText("agarre más cerrado")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(TIPS_KEY) ?? "[]")).toEqual([
      "agarre más cerrado",
    ]);
  });

  it("does not add an empty or duplicate tip", () => {
    window.localStorage.setItem(TIPS_KEY, JSON.stringify(["ya existe"]));
    const { getByRole, getByPlaceholderText, getAllByText } = renderTips();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));

    const input = getByPlaceholderText("Añade tu propio tip…");
    fireEvent.change(input, { target: { value: "   " } });
    const save = getByRole("button", { name: "Guardar tip" });
    // An empty tip is not a tip: the control stays quiet.
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "ya existe" } });
    fireEvent.click(save);
    expect(getAllByText("ya existe")).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(TIPS_KEY) ?? "[]")).toEqual([
      "ya existe",
    ]);
  });

  it("deletes one personal tip without touching the rest", () => {
    window.localStorage.setItem(
      TIPS_KEY,
      JSON.stringify(["primero", "segundo"]),
    );
    const { getByRole, getByLabelText, getByText } = renderTips();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));

    fireEvent.click(getByLabelText("Borrar tip: primero"));

    expect(getByText("segundo")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(TIPS_KEY) ?? "[]")).toEqual([
      "segundo",
    ]);
  });

  it("reloads the athlete's tips on the next visit", () => {
    window.localStorage.setItem(TIPS_KEY, JSON.stringify(["persistente"]));
    const first = renderTips();
    fireEvent.click(first.getByRole("button", { name: /Tips de técnica/ }));
    cleanup();

    const second = renderTips();
    fireEvent.click(second.getByRole("button", { name: /Tips de técnica/ }));
    expect(second.getByText("persistente")).toBeTruthy();
  });

  it("does not render the official steps when collapsed", () => {
    const { queryByText, getByRole } = renderTips();
    expect(queryByText("Baja la barra al pecho")).toBeNull();
    fireEvent.click(getByRole("button", { name: /Tips de técnica/ }));
    expect(queryByText("Baja la barra al pecho")).not.toBeNull();
  });
});
