/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CoachPortal } from "./CoachPortal";

const { ecosystemMock } = vi.hoisted(() => {
  const mockRefresh = vi.fn(async () => undefined);
  return {
    ecosystemMock: {
      loading: false,
      offer: { coachId: "coach-1", priceMxn: 450, specialty: "Hipertrofia", shift: "14:00 a 22:00", billingCycle: "mensual", benefits: ["Rutina 1-a-1"] },
      requests: [],
      templates: [{ id: "template-1", title: "Fullbody", level: "beginner", days: 3, exercises: 15 }],
      exerciseRequests: [],
      refresh: mockRefresh,
      saveOffer: vi.fn(async (value: unknown) => value),
      activateAthleteVipCash: vi.fn(async () => undefined),
      cloneTemplate: vi.fn(async () => "routine-1"),
    },
  };
});

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ userId: "coach-1" }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ loading: false, hasRole: () => true }),
}));
vi.mock("@/lib/coach/useCoachAuth", () => ({
  useCoachAuth: () => ({ lock: vi.fn() }),
}));
vi.mock("@/hooks/useCoachEcosystem", () => ({
  useCoachEcosystem: () => ecosystemMock,
}));
vi.mock("./CoachAthleteSearch", () => ({
  CoachAthleteSearch: () => <div>Buscar atleta por nombre</div>,
}));
vi.mock("./AthleteCRM", () => ({
  AthleteCRM: ({ athleteId }: { athleteId: string }) => <div>Ficha {athleteId}</div>,
}));
vi.mock("./VipRoutineBuilder", () => ({
  VipRoutineBuilder: () => <div>Constructor 1:1</div>,
}));
vi.mock("@lib/supabase", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) },
}));

afterEach(() => cleanup());

describe("CoachPortal · arquitectura de cuatro pestañas", () => {
  it("muestra solamente Clientes al entrar", () => {
    render(<CoachPortal />);
    expect(screen.getByText("Mi Oferta Comercial VIP")).toBeTruthy();
    expect(screen.queryByText("Rutinas Base Oficiales")).toBeNull();
    expect(screen.queryByText("Gobernanza de ejercicios")).toBeNull();
  });

  it("monta únicamente Plantillas al activar esa pestaña", () => {
    render(<CoachPortal />);
    fireEvent.click(screen.getByRole("button", { name: "Plantillas" }));
    expect(screen.getByText("Rutinas Base Oficiales")).toBeTruthy();
    expect(screen.getByText(/3 días · 15 ejercicios/)).toBeTruthy();
    expect(screen.queryByText("Mi Oferta Comercial VIP")).toBeNull();
    expect(screen.queryByText("Gobernanza de ejercicios")).toBeNull();
  });

  it("monta únicamente Ejercicios al activar esa pestaña", () => {
    render(<CoachPortal />);
    fireEvent.click(screen.getByRole("button", { name: "Ejercicios" }));
    expect(screen.getByText("Gobernanza de ejercicios")).toBeTruthy();
    expect(screen.queryByText("Mi Oferta Comercial VIP")).toBeNull();
    expect(screen.queryByText("Rutinas Base Oficiales")).toBeNull();
  });
});
