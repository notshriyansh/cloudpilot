import type {
  ReconciliationRunRecord,
  ReconciliationRunStore,
} from "./reconciliation-run-store";

interface ReconciliationRunRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: ReconciliationRunRecord["status"];
  result_json: string | null;
}

export function createD1ReconciliationRunStore(
  db: D1Database,
): ReconciliationRunStore {
  return {
    async saveRun(run): Promise<void> {
      await db
        .prepare(
          `INSERT INTO reconciliation_runs (
            id,
            started_at,
            completed_at,
            status,
            result_json
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            completed_at = excluded.completed_at,
            status = excluded.status,
            result_json = excluded.result_json`,
        )
        .bind(
          run.id,
          run.startedAt,
          run.completedAt ?? null,
          run.status,
          run.result === undefined ? null : JSON.stringify(run.result),
        )
        .run();
    },

    async getRun(id: string): Promise<ReconciliationRunRecord | undefined> {
      const row = await db
        .prepare(
          `SELECT
            id,
            started_at,
            completed_at,
            status,
            result_json
          FROM reconciliation_runs
          WHERE id = ?
          LIMIT 1`,
        )
        .bind(id)
        .first<ReconciliationRunRow>();

      return row === null ? undefined : deserializeRun(row);
    },

    async getLatestRun(): Promise<ReconciliationRunRecord | undefined> {
      const row = await db
        .prepare(
          `SELECT
            id,
            started_at,
            completed_at,
            status,
            result_json
          FROM reconciliation_runs
          ORDER BY started_at DESC, id DESC
          LIMIT 1`,
        )
        .first<ReconciliationRunRow>();

      return row === null ? undefined : deserializeRun(row);
    },
  };
}

function deserializeRun(row: ReconciliationRunRow): ReconciliationRunRecord {
  return {
    id: row.id,
    startedAt: row.started_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    status: row.status,
    ...(row.result_json === null
      ? {}
      : { result: JSON.parse(row.result_json) as unknown }),
  };
}
