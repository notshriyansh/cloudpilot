import { describe, expect, it } from "vitest";

import type { ExecutionRecord } from "@cloudpilot/domain";
import { createD1ExecutionStore } from "../src/d1-execution-store";

interface MockExecutionRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: ExecutionRecord["status"];
  summary_json: string | null;
  verification_json: string | null;
}

function createMockD1Database() {
  const rows = new Map<string, MockExecutionRow>();

  const db = {
    prepare(query: string) {
      let values: unknown[] = [];

      return {
        bind(...boundValues: unknown[]) {
          values = boundValues;
          return this;
        },

        async run() {
          if (query.includes("INSERT INTO execution_runs")) {
            const [
              id,
              startedAt,
              completedAt,
              status,
              summaryJson,
              verificationJson,
            ] = values as [
              string,
              string,
              string | null,
              ExecutionRecord["status"],
              string | null,
              string | null,
            ];

            const existing = rows.get(id);

            rows.set(id, {
              id,
              started_at: existing?.started_at ?? startedAt,
              completed_at: completedAt,
              status,
              summary_json: summaryJson,
              verification_json: verificationJson,
            });

            return { success: true, meta: { changes: 1 } };
          }

          throw new Error(`Unexpected D1 run query: ${query}`);
        },

        async first<T>() {
          if (query.includes("WHERE id = ?")) {
            return (rows.get(String(values[0])) ?? null) as T | null;
          }

          if (query.includes("ORDER BY started_at DESC")) {
            const latest = [...rows.values()].sort(
              (a, b) =>
                b.started_at.localeCompare(a.started_at) ||
                b.id.localeCompare(a.id),
            )[0];

            return (latest ?? null) as T | null;
          }

          throw new Error(`Unexpected D1 first query: ${query}`);
        },
      };
    },
  };

  return db as unknown as D1Database;
}

function createExecution(
  overrides: Partial<ExecutionRecord> = {},
): ExecutionRecord {
  return {
    id: "execution-1",
    startedAt: "2026-10-21T10:00:00.000Z",
    status: "succeeded",
    ...overrides,
  };
}

const verifiedResult: NonNullable<ExecutionRecord["verification"]> = {
  status: "verified",
  desired: { resources: [] },
  observed: { resources: [] },
  diff: { changes: [] },
};

describe("D1ExecutionStore", () => {
  it("returns undefined when an execution does not exist", async () => {
    const store = createD1ExecutionStore(createMockD1Database());

    await expect(store.getExecution("missing")).resolves.toBeUndefined();
    await expect(store.getLatestExecution()).resolves.toBeUndefined();
  });

  it("persists and retrieves verification results", async () => {
    const store = createD1ExecutionStore(createMockD1Database());
    const execution = createExecution({
      completedAt: "2026-10-21T10:00:05.000Z",
      verification: verifiedResult,
    });

    await store.saveExecution(execution);

    await expect(store.getExecution(execution.id)).resolves.toEqual(execution);
    await expect(store.getLatestExecution()).resolves.toEqual(execution);
  });

  it("preserves an execution without optional summary or verification", async () => {
    const store = createD1ExecutionStore(createMockD1Database());
    const execution = createExecution();

    await store.saveExecution(execution);

    await expect(store.getExecution(execution.id)).resolves.toEqual(execution);
  });

  it("persists verification mismatches and resource differences", async () => {
    const store = createD1ExecutionStore(createMockD1Database());
    const mismatch: NonNullable<ExecutionRecord["verification"]> = {
      status: "mismatch",
      desired: { resources: [] },
      observed: { resources: [] },
      diff: {
        changes: [
          {
            type: "delete",
            resource: {
              resource: { type: "worker", id: "unexpected-worker" },
              attributes: {},
            },
          },
        ],
      },
    };
    const execution = createExecution({ verification: mismatch });

    await store.saveExecution(execution);

    await expect(store.getExecution(execution.id)).resolves.toEqual(execution);
  });

  it("updates verification while preserving the original start time", async () => {
    const store = createD1ExecutionStore(createMockD1Database());
    const running = createExecution({
      status: "running",
    });

    await store.saveExecution(running);

    const completed = createExecution({
      startedAt: "2026-10-21T10:01:00.000Z",
      completedAt: "2026-10-21T10:00:05.000Z",
      status: "succeeded",
      verification: verifiedResult,
    });

    await store.saveExecution(completed);

    await expect(store.getExecution(running.id)).resolves.toEqual({
      ...completed,
      startedAt: running.startedAt,
    });
  });

  it("returns the most recently started execution", async () => {
    const store = createD1ExecutionStore(createMockD1Database());
    const earlier = createExecution({
      id: "execution-1",
      startedAt: "2026-10-21T10:00:00.000Z",
    });
    const later = createExecution({
      id: "execution-2",
      startedAt: "2026-10-21T11:00:00.000Z",
      verification: verifiedResult,
    });

    await store.saveExecution(earlier);
    await store.saveExecution(later);

    await expect(store.getLatestExecution()).resolves.toEqual(later);
  });
});
