import type { ManagementScope, ResourceId } from "@cloudpilot/domain";
import type { ManagementScopeStore } from "./management-scope-store";

interface ManagedResourceRow {
  resource_type: ResourceId["type"];
  resource_id: string;
}

export function createD1ManagementScopeStore(
  db: D1Database,
): ManagementScopeStore {
  return {
    async add(resource: ResourceId): Promise<void> {
      await db
        .prepare(
          `INSERT INTO managed_resources (
            resource_type,
            resource_id,
            created_at
          ) VALUES (?, ?, ?)
          ON CONFLICT(resource_type, resource_id) DO NOTHING`,
        )
        .bind(resource.type, resource.id, new Date().toISOString())
        .run();
    },

    async remove(resource: ResourceId): Promise<void> {
      await db
        .prepare(
          `DELETE FROM managed_resources
           WHERE resource_type = ?
           AND resource_id = ?`,
        )
        .bind(resource.type, resource.id)
        .run();
    },

    async getScope(): Promise<ManagementScope> {
      const result = await db
        .prepare(
          `SELECT
            resource_type,
            resource_id
           FROM managed_resources
           ORDER BY resource_type, resource_id`,
        )
        .all<ManagedResourceRow>();

      return {
        resources: result.results.map((row) => ({
          type: row.resource_type,
          id: row.resource_id,
        })),
      };
    },
  };
}
