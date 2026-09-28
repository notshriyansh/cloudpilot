import { describe, expect, it } from "vitest";

import type { Observation, StateStore } from "../src";

function createObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "execution-1",
    startedAt: "2026-09-27T10:00:00.000Z",
    completedAt: "2026-09-27T10:00:05.000Z",
    status: "completed",
    state: {
      resources: [
        {
          resource: {
            type: "worker",
            id: "api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    },
    ...overrides,
  };
}

function createInMemoryStateStore(): StateStore {
  const observations: Observation[] = [];

  return {
    async saveObservation(observation) {
      observations.push(observation);
    },

    async getLatestObservation() {
      return observations.at(-1);
    },
  };
}

describe("StateStore execution observations", () => {
  it("saves and retrieves an observation", async () => {
    const store = createInMemoryStateStore();
    const observation = createObservation();

    await store.saveObservation(observation);

    await expect(store.getLatestObservation()).resolves.toEqual(observation);
  });

  it("returns undefined when no observations exist", async () => {
    const store = createInMemoryStateStore();

    await expect(store.getLatestObservation()).resolves.toBeUndefined();
  });

  it("returns the latest observation", async () => {
    const store = createInMemoryStateStore();

    const first = createObservation({
      id: "execution-1",
      completedAt: "2026-09-27T10:00:05.000Z",
    });

    const second = createObservation({
      id: "execution-2",
      startedAt: "2026-09-27T11:00:00.000Z",
      completedAt: "2026-09-27T11:00:05.000Z",
    });

    await store.saveObservation(first);
    await store.saveObservation(second);

    await expect(store.getLatestObservation()).resolves.toEqual(second);
  });

  it("preserves failed observations", async () => {
    const store = createInMemoryStateStore();

    const observation = createObservation({
      id: "execution-failed",
      status: "failed",
    });

    await store.saveObservation(observation);

    const result = await store.getLatestObservation();

    expect(result).toEqual(observation);
    expect(result?.status).toBe("failed");
  });

  it("preserves the observed state associated with an observation", async () => {
    const store = createInMemoryStateStore();

    const observation = createObservation({
      state: {
        resources: [
          {
            resource: {
              type: "zone",
              id: "example.com",
            },
            attributes: {
              name: "example.com",
            },
          },
          {
            resource: {
              type: "worker",
              id: "api",
            },
            attributes: {
              compatibilityDate: "2026-08-31",
            },
          },
        ],
      },
    });

    await store.saveObservation(observation);

    const result = await store.getLatestObservation();

    expect(result?.state).toEqual(observation.state);
  });
});
