import { describe, expect, it, vi } from "vitest";
import type { ObservedState } from "@cloudpilot/domain";
import type { Observation, StateStore } from "../src";

describe("StateStore", () => {
  const state: ObservedState = {
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
    ],
  };

  const observation: Observation = {
    id: "observation-1",
    startedAt: "2026-09-06T17:00:00.000Z",
    completedAt: "2026-09-06T17:00:01.000Z",
    status: "completed",
    state,
  };

  it("can save and retrieve an observation", async () => {
    let storedObservation: Observation | undefined;

    const store: StateStore = {
      saveObservation: vi.fn(async (nextObservation) => {
        storedObservation = nextObservation;
      }),
      getLatestObservation: vi.fn(async () => storedObservation),
    };

    await store.saveObservation(observation);

    await expect(store.getLatestObservation()).resolves.toEqual(observation);

    expect(store.saveObservation).toHaveBeenCalledWith(observation);
    expect(store.getLatestObservation).toHaveBeenCalledTimes(1);
  });

  it("returns undefined when no observation exists", async () => {
    const store: StateStore = {
      saveObservation: vi.fn(),
      getLatestObservation: vi.fn(async () => undefined),
    };

    await expect(store.getLatestObservation()).resolves.toBeUndefined();
  });
});
