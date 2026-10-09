import { describe, expect, it } from "vitest";

import { createD1ReconciliationRunStore } from "../src/d1-reconciliation-run-store";
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

function createMockD1Database() {
  const rows = new Map<
    string,
    {
      id: string;
      started_at: string;
      completed_at: string | null;
      status: ReconciliationRunRecord["status"];
      result_json: string | null;
    }
  >();

  const db = {
    prepare(query: string) {
      let values: unknown[] = [];

      return {
        bind(...boundValues: unknown[]) {
          values = boundValues;
          return this;
        },

        async run() {
          if (query.includes("INSERT INTO reconciliation_runs")) {
            const [id, startedAt, completedAt, status, resultJson] = values as [
              string,
              string,
              string | null,
              ReconciliationRunRecord["status"],
              string | null,
            ];

            const existing = rows.get(id);

            rows.set(id, {
              id,
              started_at: existing?.started_at ?? startedAt,
              completed_at: completedAt,
              status,
              result_json: resultJson,
            });
          }

          return { success: true };
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

          return null;
        },
      };
    },
  };

  return db as unknown as D1Database;
}

describe("D1ReconciliationRunStore", () => {
  it("returns undefined for a missing run", async () => {
    const store = createD1ReconciliationRunStore(createMockD1Database());

    await expect(store.getRun("missing")).resolves.toBeUndefined();
  });

  it("persists and retrieves a running run", async () => {
    const store = createD1ReconciliationRunStore(createMockD1Database());
    const run = createRun();

    await store.saveRun(run);

    await expect(store.getRun(run.id)).resolves.toEqual(run);
  });

  it("updates a run while preserving its original start time", async () => {
    const store = createD1ReconciliationRunStore(createMockD1Database());
    const running = createRun();

    const completed = createRun({
      startedAt: "2026-10-09T10:05:00.000Z",
      completedAt: "2026-10-09T10:00:05.000Z",
      status: "succeeded",
      result: { status: "verified" },
    });

    await store.saveRun(running);
    await store.saveRun(completed);

    await expect(store.getRun(running.id)).resolves.toEqual({
      ...completed,
      startedAt: running.startedAt,
    });
  });

  it("returns the latest run by start time", async () => {
    const store = createD1ReconciliationRunStore(createMockD1Database());

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
