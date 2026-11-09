/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
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

describe("RoutinesPage (visual limpia)", () => {
  it("renderiza base vacía sin romper", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/rutinas"]}>
        <Routes>
          <Route path="/rutinas" element={<Outlet context={OUTLET_CONTEXT} />}>
            <Route index element={<RoutinesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container).toBeTruthy();
  });
});
