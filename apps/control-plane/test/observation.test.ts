import { describe, expect, it, vi } from "vitest";

import type { Inventory } from "@cloudpilot/inventory";
import type { Observation, StateStore } from "@cloudpilot/state-store";
import { createObservationService } from "../src/observation";

describe("ObservationService", () => {
  it("inspects inventory and persists the observation", async () => {
    const observedState = {
      resources: [
        {
          resource: {
            type: "zone" as const,
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

    const inventory: Inventory = {
      inspect: vi.fn().mockResolvedValue(observedState),
    };

    const stateStore: StateStore = {
      saveObservation: vi.fn().mockResolvedValue(undefined),
      getLatestObservation: vi.fn(),
    };

    const clock = {
      now: vi
        .fn()
        .mockReturnValueOnce(new Date("2026-09-07T10:00:00.000Z"))
        .mockReturnValueOnce(new Date("2026-09-07T10:00:05.000Z")),
    };

    const idGenerator = {
      generate: vi.fn().mockReturnValue("observation-1"),
    };

    const service = createObservationService(
      inventory,
      stateStore,
      clock,
      idGenerator,
    );

    const result = await service.inspect();

    const expectedObservation: Observation = {
      id: "observation-1",
      startedAt: "2026-09-07T10:00:00.000Z",
      completedAt: "2026-09-07T10:00:05.000Z",
      status: "completed",
      state: observedState,
    };

    expect(inventory.inspect).toHaveBeenCalledOnce();
    expect(idGenerator.generate).toHaveBeenCalledOnce();
    expect(stateStore.saveObservation).toHaveBeenCalledTimes(1);
    expect(stateStore.saveObservation).toHaveBeenCalledWith(
      expectedObservation,
    );
    expect(result).toEqual(expectedObservation);
  });

  it("does not persist an observation when inventory inspection fails", async () => {
    const error = new Error("inventory failed");

    const inventory: Inventory = {
      inspect: vi.fn().mockRejectedValue(error),
    };

    const stateStore: StateStore = {
      saveObservation: vi.fn().mockResolvedValue(undefined),
      getLatestObservation: vi.fn(),
    };

    const clock = {
      now: vi.fn().mockReturnValue(new Date("2026-09-07T10:00:00.000Z")),
    };

    const idGenerator = {
      generate: vi.fn().mockReturnValue("observation-1"),
    };

    const service = createObservationService(
      inventory,
      stateStore,
      clock,
      idGenerator,
    );

    await expect(service.inspect()).rejects.toThrow("inventory failed");

    expect(stateStore.saveObservation).not.toHaveBeenCalled();
  });

  it("uses the first clock value for startedAt and the second for completedAt", async () => {
    const inventory: Inventory = {
      inspect: vi.fn().mockResolvedValue({ resources: [] }),
    };

    const stateStore: StateStore = {
      saveObservation: vi.fn().mockResolvedValue(undefined),
      getLatestObservation: vi.fn(),
    };

    const clock = {
      now: vi
        .fn()
        .mockReturnValueOnce(new Date("2026-09-07T10:00:00.000Z"))
        .mockReturnValueOnce(new Date("2026-09-07T10:00:05.000Z")),
    };

    const idGenerator = {
      generate: vi.fn().mockReturnValue("observation-1"),
    };

    const service = createObservationService(
      inventory,
      stateStore,
      clock,
      idGenerator,
    );

    const result = await service.inspect();

    expect(result.startedAt).toBe("2026-09-07T10:00:00.000Z");
    expect(result.completedAt).toBe("2026-09-07T10:00:05.000Z");
  });
});
