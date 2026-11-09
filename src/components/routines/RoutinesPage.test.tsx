/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Routes, Route } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { RoutinesPage } from "./RoutinesPage";

vi.mock("@/hooks/useGymData", () => ({
  useRoutines: vi.fn(() => ({ routines: [], loading: false, error: null, refresh: vi.fn() })),
}));

vi.mock("@/context/ActiveSessionContext", () => ({
  useActiveSession: vi.fn(() => ({ isActive: false, start: vi.fn(), session: null })),
}));

const OUTLET_CONTEXT: WorkspaceOutletContext = {
  userId: "user-1",
  email: "user@example.com",
};

describe("RoutinesPage (Bloque 1)", () => {
  it("renderiza header, tabs y estado vacío", () => {
    render(
      <MemoryRouter initialEntries={["/rutinas"]}>
        <Routes>
          <Route path="/rutinas" element={<Outlet context={OUTLET_CONTEXT} />}>
            <Route index element={<RoutinesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Rutinas" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Mis Rutinas" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Catálogo" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Nueva rutina" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Crea tu primera rutina")).toBeTruthy();
  });
});