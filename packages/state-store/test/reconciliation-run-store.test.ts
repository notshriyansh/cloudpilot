import { describe, expect, it } from "vitest";

import { createMemoryReconciliationRunStore } from "../src/memory-reconciliation-run-store";
import type { ReconciliationRunRecord } from "../src/reconciliation-run-store";

function createRun(
  overrides: Partial<ReconciliationRunRecord> = {},
): ReconciliationRunRecord {
  return {
    id: "reconciliation-1",
    startedAt: "2026-10-09T10:00:00.000Z",
    status: "running",
    ...overrides,
  };
}

describe("startRun", () => {
  const firstRun = {
    id: "run-1",
    startedAt: "2026-10-09T10:00:00.000Z",
    status: "running" as const,
  };

  it("claims the active slot and persists the running record", async () => {
    const store = createMemoryReconciliationRunStore();

    await expect(store.startRun(firstRun)).resolves.toBe(true);
    await expect(store.getRun("run-1")).resolves.toEqual(firstRun);
  });

  it("rejects a second run while another run is active", async () => {
    const store = createMemoryReconciliationRunStore();

    await expect(store.startRun(firstRun)).resolves.toBe(true);

    await expect(
      store.startRun({
        ...firstRun,
        id: "run-2",
        startedAt: "2026-10-09T10:01:00.000Z",
      }),
    ).resolves.toBe(false);

    await expect(store.getRun("run-2")).resolves.toBeUndefined();
  });

  it("allows a new run after the previous run succeeds", async () => {
    const store = createMemoryReconciliationRunStore();

    await store.startRun(firstRun);
    await store.saveRun({
      ...firstRun,
      completedAt: "2026-10-09T10:00:05.000Z",
      status: "completed",
    });

    await expect(
      store.startRun({
        ...firstRun,
        id: "run-2",
        startedAt: "2026-10-09T10:01:00.000Z",
      }),
    ).resolves.toBe(true);
  });

  it("allows a new run after the previous run fails", async () => {
    const store = createMemoryReconciliationRunStore();

    await store.startRun(firstRun);
    await store.saveRun({
      ...firstRun,
      completedAt: "2026-10-09T10:00:05.000Z",
      status: "failed",
    });

    await expect(
      store.startRun({
        ...firstRun,
        id: "run-2",
        startedAt: "2026-10-09T10:01:00.000Z",
      }),
    ).resolves.toBe(true);
  });
});

describe("MemoryReconciliationRunStore", () => {
  it("returns undefined when a run does not exist", async () => {
    const store = createMemoryReconciliationRunStore();

    await expect(store.getRun("missing")).resolves.toBeUndefined();
  });

  it("persists and retrieves a running reconciliation", async () => {
    const store = createMemoryReconciliationRunStore();
    const run = createRun();

    await store.saveRun(run);

    await expect(store.getRun(run.id)).resolves.toEqual(run);
  });

  it("updates a running reconciliation with its terminal result", async () => {
    const store = createMemoryReconciliationRunStore();

    const running = createRun();

    const completed = createRun({
      completedAt: "2026-10-09T10:00:05.000Z",
      status: "completed",
      result: {
        status: "verified",
        desired: { resources: [] },
      },
    });

    await store.saveRun(running);
    await store.saveRun(completed);

    await expect(store.getRun(running.id)).resolves.toEqual(completed);
  });

  it("returns the latest reconciliation by start time", async () => {
    const store = createMemoryReconciliationRunStore();

    const first = createRun({
      id: "reconciliation-1",
      startedAt: "2026-10-09T10:00:00.000Z",
    });

    const second = createRun({
      id: "reconciliation-2",
      startedAt: "2026-10-09T11:00:00.000Z",
    });

    await store.saveRun(first);
    await store.saveRun(second);

    await expect(store.getLatestRun()).resolves.toEqual(second);
  });
});
