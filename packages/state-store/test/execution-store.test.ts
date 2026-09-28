import { describe, expect, it } from "vitest";

import type { ExecutionStore } from "../src";
import { ExecutionRecord } from "@cloudpilot/domain";

function createExecutionRecord(
  overrides: Partial<ExecutionRecord> = {},
): ExecutionRecord {
  return {
    id: "execution-1",
    startedAt: "2026-09-27T10:00:00.000Z",
    status: "running",
    ...overrides,
  };
}

function createInMemoryExecutionStore(): ExecutionStore {
  const executions: ExecutionRecord[] = [];

  return {
    async saveExecution(execution) {
      const existingIndex = executions.findIndex(
        (candidate) => candidate.id === execution.id,
      );

      if (existingIndex === -1) {
        executions.push(execution);
      } else {
        executions[existingIndex] = execution;
      }
    },

    async getExecution(id) {
      return executions.find((execution) => execution.id === id);
    },

    async getLatestExecution() {
      return executions.at(-1);
    },
  };
}

describe("ExecutionStore", () => {
  it("saves and retrieves an execution", async () => {
    const store = createInMemoryExecutionStore();

    const execution = createExecutionRecord();

    await store.saveExecution(execution);

    await expect(store.getExecution(execution.id)).resolves.toEqual(execution);
  });

  it("returns undefined when execution does not exist", async () => {
    const store = createInMemoryExecutionStore();

    await expect(store.getExecution("missing")).resolves.toBeUndefined();
  });

  it("updates an existing execution record", async () => {
    const store = createInMemoryExecutionStore();

    const running = createExecutionRecord({
      status: "running",
    });

    const completed: ExecutionRecord = {
      ...running,
      completedAt: "2026-09-27T10:00:05.000Z",
      status: "succeeded",
    };

    await store.saveExecution(running);
    await store.saveExecution(completed);

    await expect(store.getExecution(running.id)).resolves.toEqual(completed);
  });

  it("returns the latest execution", async () => {
    const store = createInMemoryExecutionStore();

    const first = createExecutionRecord({
      id: "execution-1",
      startedAt: "2026-09-27T10:00:00.000Z",
    });

    const second = createExecutionRecord({
      id: "execution-2",
      startedAt: "2026-09-27T11:00:00.000Z",
    });

    await store.saveExecution(first);
    await store.saveExecution(second);

    await expect(store.getLatestExecution()).resolves.toEqual(second);
  });

  it("preserves failed executions", async () => {
    const store = createInMemoryExecutionStore();

    const execution = createExecutionRecord({
      id: "execution-failed",
      completedAt: "2026-09-27T10:00:05.000Z",
      status: "failed",
    });

    await store.saveExecution(execution);

    const result = await store.getExecution(execution.id);

    expect(result).toEqual(execution);
    expect(result?.status).toBe("failed");
  });
});
