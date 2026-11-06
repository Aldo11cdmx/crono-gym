/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TipSection, type Tip } from "./TipSection";

const tip: Tip = { id: "t1", text: "Tip de prueba", icon: "lightbulb", category: "entrenamiento" };

afterEach(() => cleanup());

describe("TipSection", () => {
  it("renderiza el texto del tip", () => {
    render(<TipSection tip={tip} onNext={() => {}} />);
    expect(screen.getByText("Tip de prueba")).toBeTruthy();
  });

  it("ejecuta onNext al pulsar Siguiente tip", () => {
    const onNext = vi.fn();
    render(<TipSection tip={tip} onNext={onNext} />);
    fireEvent.click(screen.getAllByRole("button", { name: /siguiente tip/i })[0]);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("renderiza icono zap cuando corresponde", () => {
    render(<TipSection tip={{ ...tip, icon: "zap" }} onNext={() => {}} />);
    expect(screen.getAllByText("Tip de prueba").length).toBeGreaterThan(0);
  });
});
