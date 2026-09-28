import type { ExecutionRecord } from "@cloudpilot/domain";
import type { ExecutionStore } from "./execution-store";

interface ExecutionRunRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: ExecutionRecord["status"];
  summary_json: string | null;
}

export function createD1ExecutionStore(db: D1Database): ExecutionStore {
  return {
    async saveExecution(execution): Promise<void> {
      await db
        .prepare(
          `INSERT INTO execution_runs (
        id,
        started_at,
        completed_at,
        status,
        summary_json
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        completed_at = excluded.completed_at,
        status = excluded.status,
        summary_json = excluded.summary_json`,
        )
        .bind(
          execution.id,
          execution.startedAt,
          execution.completedAt ?? null,
          execution.status,
          execution.summary === undefined
            ? null
            : JSON.stringify(execution.summary),
        )
        .run();
    },

    async getExecution(id): Promise<ExecutionRecord | undefined> {
      const row = await db
        .prepare(
          `SELECT
            id,
            started_at,
            completed_at,
            status,
            summary_json
          FROM execution_runs
          WHERE id = ?
          LIMIT 1`,
        )
        .bind(id)
        .first<ExecutionRunRow>();

      if (row === null) {
        return undefined;
      }

      return deserializeExecution(row);
    },

    async getLatestExecution(): Promise<ExecutionRecord | undefined> {
      const row = await db
        .prepare(
          `SELECT
            id,
            started_at,
            completed_at,
            status,
            summary_json
          FROM execution_runs
          ORDER BY started_at DESC, id DESC
          LIMIT 1`,
        )
        .first<ExecutionRunRow>();

      if (row === null) {
        return undefined;
      }

      return deserializeExecution(row);
    },
  };
}

function deserializeExecution(row: ExecutionRunRow): ExecutionRecord {
  return {
    id: row.id,
    startedAt: row.started_at,
    ...(row.completed_at === null
      ? {}
      : {
          completedAt: row.completed_at,
        }),
    status: row.status,
    ...(row.summary_json === null
      ? {}
      : {
          summary: JSON.parse(row.summary_json),
        }),
  };
}
