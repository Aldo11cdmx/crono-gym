import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  deleteDraft: vi.fn(),
  enqueueFinalize: vi.fn(),
  listQueue: vi.fn(),
  removeFromQueue: vi.fn(),
  updateQueueOp: vi.fn(),
  notifyTrainingDataChanged: vi.fn(),
}));

vi.mock("@lib/supabase", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  },
}));

vi.mock("./trainingEvents", () => ({
  notifyTrainingDataChanged: mocks.notifyTrainingDataChanged,
}));

vi.mock("./offlineStore", () => ({
  deleteDraft: mocks.deleteDraft,
  enqueueFinalize: mocks.enqueueFinalize,
  listQueue: mocks.listQueue,
  removeFromQueue: mocks.removeFromQueue,
  updateQueueOp: mocks.updateQueueOp,
}));

import { drainQueue, pushSession, queueAndSync } from "./sessionSync";
import type { FinalizePayload, QueueOp } from "./offlineStore";

const payload: FinalizePayload = {
  logId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  routineId: null,
  startedAt: "2026-10-23T10:00:00.000Z",
  completedAt: "2026-10-23T10:45:00.000Z",
  notes: "sesión de prueba",
  sets: [
    {
      exercise_id: "0001",
      set_number: 1,
      weight: 20,
      reps: 10,
      rpe: 8,
      is_warmup: false,
      notes: null,
    },
  ],
};

const operation: QueueOp = {
  id: `finalize:${payload.logId}`,
  kind: "finalize_session",
  payload,
  createdAt: 1,
  attempts: 0,
  lastError: null,
};

describe("sessionSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: payload.logId, error: null });
    mocks.deleteDraft.mockResolvedValue(undefined);
    mocks.enqueueFinalize.mockResolvedValue(operation);
    mocks.listQueue.mockResolvedValue([operation]);
    mocks.removeFromQueue.mockResolvedValue(undefined);
    mocks.updateQueueOp.mockResolvedValue(undefined);
  });

  it("finaliza una sesión sin convertir los IDs de ejercicio a UUID", async () => {
    await pushSession(payload);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "finalize_session",
      expect.objectContaining({
        p_log_id: payload.logId,
        p_user_id: payload.userId,
        p_sets: [
          expect.objectContaining({
            exercise_id: "0001",
            set_number: 1,
          }),
        ],
      }),
    );
    expect(mocks.notifyTrainingDataChanged).toHaveBeenCalledOnce();
  });

  it("rechaza una sesión si no hay usuario autenticado", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(pushSession(payload)).rejects.toThrow("Sin sesión iniciada");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rechaza una sesión perteneciente a otra cuenta", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });

    await expect(pushSession(payload)).rejects.toThrow(
      "Esta sesión pertenece a otra cuenta",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("elimina cola y borrador solo después de sincronizar correctamente", async () => {
    const result = await drainQueue();

    expect(result.succeeded).toBe(1);
    expect(mocks.removeFromQueue).toHaveBeenCalledWith(operation.id);
    expect(mocks.deleteDraft).toHaveBeenCalledWith(payload.logId);
  });

  it("conserva la operación pendiente cuando falla la red", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Failed to fetch" },
    });

    const result = await drainQueue();

    expect(result.failed).toBe(1);
    expect(mocks.updateQueueOp).toHaveBeenCalledWith(
      expect.objectContaining({
        id: operation.id,
        attempts: 1,
        lastError: "Failed to fetch",
      }),
    );
    expect(mocks.removeFromQueue).not.toHaveBeenCalled();
    expect(mocks.deleteDraft).not.toHaveBeenCalled();
  });

  it("conserva la sesión si el RPC falla con un error permanente", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "function finalize_session not found" },
    });

    const result = await drainQueue();

    expect(result.failed).toBe(1);
    expect(mocks.updateQueueOp).toHaveBeenCalledWith(
      expect.objectContaining({
        id: operation.id,
        attempts: 1,
        lastError: "function finalize_session not found",
      }),
    );
    expect(mocks.removeFromQueue).not.toHaveBeenCalled();
    expect(mocks.deleteDraft).not.toHaveBeenCalled();
  });

  it("no elimina el borrador si falla la sincronización", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await drainQueue();

    expect(mocks.deleteDraft).not.toHaveBeenCalled();
  });

  it("encola primero la sesión antes de intentar sincronizar", async () => {
    mocks.listQueue.mockResolvedValue([]);

    const result = await queueAndSync(payload);

    expect(mocks.enqueueFinalize).toHaveBeenCalledWith(payload);
    expect(result?.attempted).toBe(0);
  });
});
