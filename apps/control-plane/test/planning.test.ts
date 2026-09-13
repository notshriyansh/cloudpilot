import { describe, expect, it, vi } from "vitest";
import type { DesiredState } from "@cloudpilot/domain";
import type { Observation, StateStore } from "@cloudpilot/state-store";
import { createPlanningService, NoObservationError } from "../src/planning";

describe("PlanningService", () => {
  it("creates a plan from desired state and the latest observation", async () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "payments-api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    const observation: Observation = {
      id: "observation-1",
      startedAt: "2026-09-12T10:00:00.000Z",
      completedAt: "2026-09-12T10:00:05.000Z",
      status: "completed",
      state: {
        resources: [],
      },
    };

    const getLatestObservation = vi.fn().mockResolvedValue(observation);

    const stateStore: StateStore = {
      saveObservation: vi.fn(),
      getLatestObservation,
    };

    const planningService = createPlanningService(stateStore, {
      resources: [
        {
          type: "worker",
          id: "payments-api",
        },
      ],
    });

    const plan = await planningService.plan(desired);

    expect(plan.operations).toEqual([
      {
        action: "create",
        resource: {
          type: "worker",
          id: "payments-api",
        },
        desired: desired.resources[0],
        dependencies: [],
      },
    ]);

    expect(getLatestObservation).toHaveBeenCalledTimes(1);
  });

  it("throws when no observation exists", async () => {
    const stateStore: StateStore = {
      saveObservation: vi.fn(),
      getLatestObservation: vi.fn().mockResolvedValue(undefined),
    };

    const planningService = createPlanningService(stateStore, {
      resources: [
        {
          type: "worker",
          id: "payments-api",
        },
      ],
    });

    await expect(
      planningService.plan({
        resources: [],
      }),
    ).rejects.toBeInstanceOf(NoObservationError);
  });
});
