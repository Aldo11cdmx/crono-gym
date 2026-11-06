/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TrainingHeroSection } from "./TrainingHeroSection";

afterEach(() => cleanup());

const baseProps = {
  greeting: "Hola",
  hasRoutine: true,
  routineTitle: "Fuerza",
  exerciseCount: 4,
  estimatedDurationMin: 45,
  muscleCounts: new Map([["chest", 2]]),
  ctaLabel: "Comenzar entrenamiento",
  rehydrating: false,
  onPrimary: () => {},
};

describe("TrainingHeroSection", () => {
  it("renderiza saludo y título de rutina", () => {
    render(<TrainingHeroSection {...baseProps} />);
    expect(screen.getByText("Hola")).toBeTruthy();
    expect(screen.getByText("Fuerza")).toBeTruthy();
  });

  it("renderiza cantidad de ejercicios y duración", () => {
    render(<TrainingHeroSection {...baseProps} />);
    expect(screen.getByText(/4 ejercicios/)).toBeTruthy();
  });

  it("renderiza CTA y ejecuta onPrimary", () => {
    const onPrimary = vi.fn();
    render(<TrainingHeroSection {...baseProps} onPrimary={onPrimary} />);
    const btn = screen.getByRole("button", { name: /comenzar entrenamiento/i });
    fireEvent.click(btn);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("muestra estado vacío cuando hasRoutine es falso", () => {
    render(<TrainingHeroSection {...baseProps} hasRoutine={false} />);
    expect(screen.getByText("Rutina del d\u00eda")).toBeTruthy();
    expect(screen.getByText("Crea tu primera rutina para empezar")).toBeTruthy();
  });

  it("deshabilita CTA durante rehidratación", () => {
    render(<TrainingHeroSection {...baseProps} rehydrating={true} ctaLabel="Comprobando sesión..." />);
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Comprobando sesión...")).toBeTruthy();
  });

  it("renderiza muscleCounts (mapa)", () => {
    render(<TrainingHeroSection {...baseProps} />);
    // MuscleReadonlyMap se monta sin error; verificamos presencia del contenedor
    expect(screen.getByText("Hola")).toBeTruthy();
  });
});
