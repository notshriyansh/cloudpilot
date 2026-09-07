import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { Observation } from "@cloudpilot/state-store";
import { createD1StateStore } from "@cloudpilot/state-store";

describe("D1 state store", () => {
  it("persists and retrieves an observation", async () => {
    const store = createD1StateStore(env.cloudpilot);

    const observation: Observation = {
      id: "observation-1",
      startedAt: "2026-09-06T10:00:00.000Z",
      completedAt: "2026-09-06T10:00:01.000Z",
      status: "completed",
      state: {
        resources: [
          {
            resource: {
              type: "zone",
              id: "zone-1",
            },
            attributes: {
              name: "example.com",
              status: "active",
              accountId: "account-1",
            },
          },
          {
            resource: {
              type: "dns_record",
              id: "record-1",
            },
            attributes: {
              name: "api.example.com",
              type: "A",
              content: "192.0.2.1",
              ttl: 300,
              proxied: true,
            },
            relationships: [
              {
                type: "belongs_to",
                resource: {
                  type: "zone",
                  id: "zone-1",
                },
              },
            ],
          },
        ],
      },
    };

    await store.saveObservation(observation);

    await expect(store.getLatestObservation()).resolves.toEqual(observation);
  });

  it("returns the most recent observation", async () => {
    const store = createD1StateStore(env.cloudpilot);

    const firstObservation: Observation = {
      id: "observation-old",
      startedAt: "2026-09-06T10:00:00.000Z",
      completedAt: "2026-09-06T10:00:01.000Z",
      status: "completed",
      state: {
        resources: [],
      },
    };

    const secondObservation: Observation = {
      id: "observation-new",
      startedAt: "2026-09-06T11:00:00.000Z",
      completedAt: "2026-09-06T11:00:01.000Z",
      status: "completed",
      state: {
        resources: [],
      },
    };

    await store.saveObservation(firstObservation);
    await store.saveObservation(secondObservation);

    await expect(store.getLatestObservation()).resolves.toEqual(
      secondObservation,
    );
  });
});
