import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoutineSaveQueue, type SaveJob } from "./routineSaveQueue";
import type { RoutineDraftV2 } from "./routineDayModel";

function makeDraft(overrides: Partial<RoutineDraftV2> = {}): RoutineDraftV2 {
  return {
    draftKey: crypto.randomUUID(),
    id: null,
    title: "Test",
    description: "",
    mode: "single",
    days: [],
    snapshot: null,
    ...overrides,
  };
}

function makeJob(overrides: Partial<SaveJob> = {}): SaveJob {
  return {
    draftKey: "key-1",
    routineId: null,
    draft: makeDraft(),
    generation: 1,
    origin: "editor",
    ...overrides,
  };
}

function execKey(job: SaveJob): string {
  return job.routineId ?? `draft:${job.draftKey}`;
}

describe("routineSaveQueue · estados", () => {
  let queue: ReturnType<typeof createRoutineSaveQueue>;
  let process: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process = vi.fn().mockResolvedValue(true);
    queue = createRoutineSaveQueue(process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // U28: enqueue marca dirty y programa procesamiento
  it("U28: enqueue pasa a dirty y programa el procesamiento", () => {
    const job = makeJob();
    queue.enqueue(job);
    expect(queue.state(execKey(job))).toBe("dirty");
    expect(process).not.toHaveBeenCalled();
  });

  // U29: serial por draftKey — no se procesan dos a la vez para el mismo draftKey
  it("U29: serial por draftKey, no procesa dos jobs simultáneos", async () => {
    let resolveFirst = (() => {}) as (value: unknown) => void;
    process.mockImplementation(() => {
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    });

    vi.useFakeTimers();
    queue.enqueue(makeJob({ draftKey: "k1", generation: 1 }));
    vi.advanceTimersByTime(800);
    expect(process).toHaveBeenCalledTimes(1);

    // Mientras se procesa gen 1, se encola gen 2: no inicia concurrente
    queue.enqueue(makeJob({ draftKey: "k1", generation: 2 }));
    expect(process).toHaveBeenCalledTimes(1);

    resolveFirst(true);
    await Promise.resolve();
    vi.advanceTimersByTime(800);
    expect(process).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  // U30: generación descarta trabajos obsoletos
  it("U30: generación menor o igual no reemplaza el pendiente", () => {
    queue.enqueue(makeJob({ draftKey: "k1", generation: 5 }));
    queue.enqueue(makeJob({ draftKey: "k1", generation: 3 }));
    expect(process).not.toHaveBeenCalled();
  });

  // U31: debounce retrasa el procesamiento
  it("U31: debounce retrasa el procesamiento 800ms", async () => {
    vi.useFakeTimers();
    queue.enqueue(makeJob());
    expect(process).not.toHaveBeenCalled();
    vi.advanceTimersByTime(799);
    expect(process).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(process).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // I1: flush procesa inmediatamente sin esperar debounce
  it("I1: flush procesa inmediatamente", async () => {
    const job = makeJob();
    queue.enqueue(job);
    const result = await queue.flush(execKey(job));
    expect(result).toBe(true);
    expect(process).toHaveBeenCalledTimes(1);
  });

  // I2: flush sin trabajo pendiente resuelve true
  it("I2: flush sin trabajo pendiente resuelve true", async () => {
    expect(await queue.flush("draft:nonexistent")).toBe(true);
  });

  // I3: estado inicial es idle
  it("I3: estado inicial es idle", () => {
    expect(queue.state("any-key")).toBe("idle");
  });

  // I4: después de procesar exitosamente, estado vuelve a idle
  it("I4: después de procesar exitosamente, estado es idle", async () => {
    process.mockResolvedValue(true);
    const job = makeJob();
    queue.enqueue(job);
    await queue.flush(execKey(job));
    expect(queue.state(execKey(job))).toBe("idle");
  });

  // I5: después de fallo, estado es error
  it("I5: después de fallo, estado es error", async () => {
    process.mockResolvedValue(false);
    const job = makeJob();
    queue.enqueue(job);
    await queue.flush(execKey(job));
    expect(queue.state(execKey(job))).toBe("error");
  });

  // I6: subscribe recibe cambios de estado
  it("I6: subscribe recibe cambios de estado", () => {
    const listener = vi.fn();
    const unsub = queue.subscribe(execKey(makeJob()), listener);
    queue.enqueue(makeJob());
    expect(listener).toHaveBeenCalledWith("dirty");
    unsub();
  });

  // I7: después de unsubscribe no recibe más eventos
  it("I7: después de unsubscribe no recibe más eventos", () => {
    const listener = vi.fn();
    const unsub = queue.subscribe(execKey(makeJob()), listener);
    unsub();
    queue.enqueue(makeJob());
    expect(listener).not.toHaveBeenCalled();
  });

  // I8: diferentes draftKeys tienen colas independientes
  it("I8: diferentes draftKeys se procesan de forma independiente", async () => {
    const calls: string[] = [];
    process.mockImplementation((job) => {
      calls.push(job.draftKey);
      return Promise.resolve(true);
    });

    queue.enqueue(makeJob({ draftKey: "k1", generation: 1 }));
    queue.enqueue(makeJob({ draftKey: "k2", generation: 1 }));

    await queue.flush("draft:k1");
    await queue.flush("draft:k2");
    expect(calls).toContain("k1");
    expect(calls).toContain("k2");
  });

  // I9: misma draftKey con generación creciente reemplaza
  it("I9: misma draftKey con generación creciente reemplaza el pendiente", async () => {
    const job1 = makeJob({ draftKey: "k1", generation: 1, draft: makeDraft({ title: "A" }) });
    const job2 = makeJob({ draftKey: "k1", generation: 2, draft: makeDraft({ title: "B" }) });
    queue.enqueue(job1);
    queue.enqueue(job2);
    await queue.flush("draft:k1");
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({ draft: expect.objectContaining({ title: "B" }) }),
    );
  });

  // I10: execKey usa routineId cuando está disponible
  it("I10: execKey usa routineId para el estado", () => {
    const job = makeJob({ routineId: "routine-1", draftKey: "dk-1" });
    queue.enqueue(job);
    expect(queue.state("routine-1")).toBe("dirty");
    expect(queue.state("draft:dk-1")).toBe("idle");
  });

  // I11: processor recibe el job completo con origin
  it("I11: processor recibe el job completo con origin", async () => {
    const job = makeJob({ origin: "planner" });
    queue.enqueue(job);
    await queue.flush("draft:key-1");
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "planner" }),
    );
  });

  // I12: diferentes draftKeys se procesan de forma independiente
  it("I12: claves distintas no se bloquean entre sí", async () => {
    const order: string[] = [];
    process.mockImplementation((job) => {
      order.push(job.draftKey);
      return new Promise((resolve) => setTimeout(() => resolve(true), 50));
    });

    queue.enqueue(makeJob({ draftKey: "k1" }));
    queue.enqueue(makeJob({ draftKey: "k2" }));

    await queue.flush("draft:k1");
    await queue.flush("draft:k2");
    expect(order).toHaveLength(2);
  });

  // I13: estado de una clave no afecta a otra
  it("I13: error en una clave no afecta a otra", async () => {
    process.mockImplementation((job) =>
      job.draftKey === "fail" ? Promise.resolve(false) : Promise.resolve(true),
    );

    queue.enqueue(makeJob({ draftKey: "fail" }));
    queue.enqueue(makeJob({ draftKey: "ok" }));

    await queue.flush("draft:fail");
    await queue.flush("draft:ok");

    expect(queue.state("draft:fail")).toBe("error");
    expect(queue.state("draft:ok")).toBe("idle");
  });

  // I14: enqueue con mismo draftKey y misma generación no duplica
  it("I14: mismo draftKey y misma generación no encola dos veces", async () => {
    const job = makeJob({ draftKey: "k1", generation: 1 });
    queue.enqueue(job);
    queue.enqueue(job);
    await queue.flush("draft:k1");
    expect(process).toHaveBeenCalledTimes(1);
  });

  // I15: flush con timer pendiente lo cancela y procesa inmediatamente
  it("I15: flush cancela el timer y procesa inmediatamente", async () => {
    vi.useFakeTimers();
    queue.enqueue(makeJob());
    vi.advanceTimersByTime(100);
    await queue.flush("draft:key-1");
    expect(process).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // I16: subscribe retorna función de desuscripción
  it("I16: subscribe retorna función para desuscribirse", () => {
    const listener = vi.fn();
    const unsub = queue.subscribe(execKey(makeJob()), listener);
    expect(typeof unsub).toBe("function");
    queue.enqueue(makeJob());
    expect(listener).toHaveBeenCalled();
    unsub();
    listener.mockClear();
    queue.enqueue(makeJob());
    expect(listener).not.toHaveBeenCalled();
  });

  // I17: estado dirty se establece antes del procesamiento
  it("I17: estado dirty se establece al encolar", () => {
    const job = makeJob();
    queue.enqueue(job);
    expect(queue.state(execKey(job))).toBe("dirty");
  });

  // I18: estado saving durante el procesamiento
  it("I18: estado saving durante el procesamiento", async () => {
    let resolveProcessing = (() => {}) as (value: unknown) => void;
    process.mockImplementation(() => {
      return new Promise((resolve) => {
        resolveProcessing = resolve;
      });
    });

    vi.useFakeTimers();
    const job = makeJob();
    queue.enqueue(job);
    vi.advanceTimersByTime(800);
    expect(queue.state(execKey(job))).toBe("saving");

    resolveProcessing(true);
    await Promise.resolve();
    expect(queue.state(execKey(job))).toBe("idle");
    vi.useRealTimers();
  });

  // I19: un job con generación menor al pendiente no reemplaza ni se procesa
  it("I19: job con generación menor no reemplaza al pendiente", () => {
    vi.useFakeTimers();
    const job1 = makeJob({ generation: 5 });
    const job2 = makeJob({ generation: 3 });
    queue.enqueue(job1);
    queue.enqueue(job2);
    vi.advanceTimersByTime(900);
    vi.useRealTimers();
    // Solo job1 (generación 5) debe procesarse
    expect(process).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(job1);
  });

  // I20: flush después de encolar con timer pendiente
  it("I20: flush después de encolar con timer pendiente procesa ahora", async () => {
    vi.useFakeTimers();
    const job = makeJob();
    queue.enqueue(job);
    vi.advanceTimersByTime(100);
    const result = await queue.flush(execKey(job));
    expect(result).toBe(true);
    expect(process).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
