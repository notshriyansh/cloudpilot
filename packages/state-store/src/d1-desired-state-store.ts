import type { DesiredState } from "@cloudpilot/domain";
import type { DesiredStateStore } from "./desired-state-store";

interface DesiredStateRow {
  state_json: string;
}

export function createD1DesiredStateStore(db: D1Database): DesiredStateStore {
  return {
    async saveDesiredState(state): Promise<void> {
      await db
        .prepare(
          `INSERT INTO desired_state (
            id,
            state_json,
            updated_at
          ) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            state_json = excluded.state_json,
            updated_at = excluded.updated_at`,
        )
        .bind(JSON.stringify(state), new Date().toISOString())
        .run();
    },

    async getDesiredState(): Promise<DesiredState | undefined> {
      const row = await db
        .prepare(
          `SELECT state_json
           FROM desired_state
           WHERE id = 1
           LIMIT 1`,
        )
        .first<DesiredStateRow>();

      if (row === null) {
        return undefined;
      }

      return JSON.parse(row.state_json) as DesiredState;
    },
  };
}
