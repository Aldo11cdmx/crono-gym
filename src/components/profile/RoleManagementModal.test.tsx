/**
 * @vitest-environment jsdom
 *
 * RoleManagementModal: ascender o degradar usuarios por correo mediante el RPC
 * `grant_user_role`. Cubre renderizado abierto/cerrado, carga del roster al abrir,
 * llamada al RPC al otorgar, banner de éxito/error y el flujo de editar un rol
 * existente.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ROLE_LABELS } from "@/lib/i18n";

const db = vi.hoisted(() => ({
  roster: [] as { user_id: string; role: string; granted_at: string }[],
  rpcError: null as Error | null,
  rpcCalls: [] as Array<{ name: string; params: unknown }>,
}));

vi.mock("@lib/supabase", () => {
  const thenable = {
    select: () => thenable,
    in: () => thenable,
    order: () => thenable,
    then: (onOk: (v: unknown) => unknown) =>
      Promise.resolve({ data: db.roster, error: null }).then(onOk),
  };
  return {
    supabase: {
      from: () => thenable,
      rpc: (name: string, params: unknown) => {
        db.rpcCalls.push({ name, params });
        if (db.rpcError) return Promise.resolve({ data: null, error: db.rpcError });
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

import { RoleManagementModal } from "./RoleManagementModal";

beforeEach(() => {
  db.roster = [];
  db.rpcError = null;
  db.rpcCalls.length = 0;
  vi.clearAllMocks();
});

afterEach(() => cleanup());

const openModal = () =>
  render(<RoleManagementModal open onClose={vi.fn()} />);

describe("RoleManagementModal", () => {
  it("no renderiza nada cuando está cerrado", () => {
    const { container } = render(
      <RoleManagementModal open={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza título, formulario y roster cuando está abierto", () => {
    openModal();
    screen.getByText(ROLE_LABELS.title);
    screen.getByPlaceholderText(ROLE_LABELS.emailPlaceholder);
    screen.getByRole("radiogroup");
    screen.getByText(ROLE_LABELS.listTitle);
  });

  it("carga el roster al abrirse el modal y lo lista", async () => {
    db.roster = [
      { user_id: "u-abc12345", role: "coach", granted_at: "2026-01-01" },
    ];
    openModal();
    await waitFor(() =>
      expect(screen.getByText("…abc12345")).toBeDefined(),
    );
    expect(
      screen.getAllByText(ROLE_LABELS.coach).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("otorga un rol llamando al RPC con (target_email, new_role)", async () => {
    openModal();
    const email = screen.getByPlaceholderText(
      ROLE_LABELS.emailPlaceholder,
    ) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "atleta@example.com" } });
    fireEvent.click(screen.getByRole("radio", { name: ROLE_LABELS.coach }));
    fireEvent.click(screen.getByText(ROLE_LABELS.grant));
    await waitFor(() =>
      expect(db.rpcCalls.some((c) => c.name === "grant_user_role")).toBe(true),
    );
    const call = db.rpcCalls.find((c) => c.name === "grant_user_role");
    expect(call).toBeDefined();
    expect(
      (call!.params as { target_email: string; new_role: string }).target_email,
    ).toBe("atleta@example.com");
    expect(
      (call!.params as { target_email: string; new_role: string }).new_role,
    ).toBe("coach");
  });

  it("muestra banner de éxito tras otorgar", async () => {
    openModal();
    const email = screen.getByPlaceholderText(
      ROLE_LABELS.emailPlaceholder,
    ) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "atleta@example.com" } });
    fireEvent.click(screen.getByText(ROLE_LABELS.grant));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        ROLE_LABELS.success,
      ),
    );
  });

  it("muestra banner de error cuando el RPC falla", async () => {
    db.rpcError = new Error("no permisos");
    openModal();
    const email = screen.getByPlaceholderText(
      ROLE_LABELS.emailPlaceholder,
    ) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "atleta@example.com" } });
    fireEvent.click(screen.getByText(ROLE_LABELS.grant));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        ROLE_LABELS.error,
      ),
    );
  });

  it("flujo de editar: abre select, cambia rol y guarda", async () => {
    db.roster = [
      { user_id: "u-1", role: "coach", granted_at: "2026-01-01" },
    ];
    openModal();
    await waitFor(() =>
      expect(screen.getByText("…u-1")).toBeDefined(),
    );
    fireEvent.click(screen.getByText(ROLE_LABELS.edit));
    // Habilitar el botón Guardar (disabled mientras editEmail esté vacío)
    const emailInputs = screen.getAllByPlaceholderText(
      ROLE_LABELS.emailPlaceholder,
    );
    fireEvent.change(emailInputs[1], {
      target: { value: "editor@example.com" },
    });
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "admin" } });
    fireEvent.click(screen.getByText(ROLE_LABELS.save));
    await waitFor(() =>
      expect(
        db.rpcCalls.some(
          (c) =>
            c.name === "grant_user_role" &&
            (c.params as { new_role: string }).new_role === "admin" &&
            (c.params as { target_email: string }).target_email ===
              "editor@example.com",
        ),
      ).toBe(true),
    );
  });
});
