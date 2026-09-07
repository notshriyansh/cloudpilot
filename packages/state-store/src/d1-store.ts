import type { ObservedState, ResourceState } from "@cloudpilot/domain";
import type { Observation, StateStore } from "./store";

interface ObservationRunRow {
  id: string;
  started_at: string;
  completed_at: string;
  status: Observation["status"];
}

interface ObservedResourceRow {
  resource_type: ResourceState["resource"]["type"];
  resource_id: string;
  attributes_json: string;
  relationships_json: string | null;
}

export function createD1StateStore(db: D1Database): StateStore {
  return {
    async saveObservation(observation): Promise<void> {
      const runStatement = db
        .prepare(
          `INSERT INTO observation_runs (
            id,
            started_at,
            completed_at,
            status
          ) VALUES (?, ?, ?, ?)`,
        )
        .bind(
          observation.id,
          observation.startedAt,
          observation.completedAt,
          observation.status,
        );

      const resourceStatements = observation.state.resources.map(
        (resource, position) =>
          db
            .prepare(
              `INSERT INTO observed_resources (
          observation_id,
          resource_type,
          resource_id,
          attributes_json,
          relationships_json,
          position
        ) VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              observation.id,
              resource.resource.type,
              resource.resource.id,
              JSON.stringify(resource.attributes),
              resource.relationships === undefined
                ? null
                : JSON.stringify(resource.relationships),
              position,
            ),
      );

      await db.batch([runStatement, ...resourceStatements]);
    },

    async getLatestObservation(): Promise<Observation | undefined> {
      const run = await db
        .prepare(
          `SELECT
            id,
            started_at,
            completed_at,
            status
          FROM observation_runs
          ORDER BY completed_at DESC, id DESC
          LIMIT 1`,
        )
        .first<ObservationRunRow>();

      if (run === null) {
        return undefined;
      }

      const resources = await db
        .prepare(
          `SELECT
            resource_type,
            resource_id,
            attributes_json,
            relationships_json
        FROM observed_resources
        WHERE observation_id = ?
        ORDER BY position`,
        )
        .bind(run.id)
        .all<ObservedResourceRow>();

      return {
        id: run.id,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        status: run.status,
        state: {
          resources: resources.results.map((row) => ({
            resource: {
              type: row.resource_type,
              id: row.resource_id,
            },
            attributes: JSON.parse(row.attributes_json) as Record<
              string,
              unknown
            >,
            ...(row.relationships_json === null
              ? {}
              : {
                  relationships: JSON.parse(row.relationships_json),
                }),
          })),
        },
      };
    },
  };
}
