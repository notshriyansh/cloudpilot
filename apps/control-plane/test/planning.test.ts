import { describe, expect, it, vi } from "vitest";
import type { DesiredState } from "@cloudpilot/domain";
import type {
  ManagementScopeStore,
  Observation,
  StateStore,
} from "@cloudpilot/state-store";
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

    const managementScopeStore: ManagementScopeStore = {
      add: vi.fn(),
      remove: vi.fn(),
      getScope: vi.fn().mockResolvedValue({
        resources: [
          {
            type: "worker",
            id: "payments-api",
          },
        ],
      }),
    };

    const planningService = createPlanningService(
      stateStore,
      managementScopeStore,
    );

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
    expect(managementScopeStore.getScope).toHaveBeenCalledTimes(1);
  });

  it("throws when no observation exists", async () => {
    const stateStore: StateStore = {
      saveObservation: vi.fn(),
      getLatestObservation: vi.fn().mockResolvedValue(undefined),
    };

    const managementScopeStore: ManagementScopeStore = {
      add: vi.fn(),
      remove: vi.fn(),
      getScope: vi.fn(),
    };

    const planningService = createPlanningService(
      stateStore,
      managementScopeStore,
    );

    await expect(
      planningService.plan({
        resources: [],
      }),
    ).rejects.toBeInstanceOf(NoObservationError);

    expect(managementScopeStore.getScope).not.toHaveBeenCalled();
  });

  it("uses the current management scope when planning", async () => {
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
        {
          resource: {
            type: "worker",
            id: "unmanaged-api",
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

    const stateStore: StateStore = {
      saveObservation: vi.fn(),
      getLatestObservation: vi.fn().mockResolvedValue(observation),
    };

    const getScope = vi
      .fn()
      .mockResolvedValueOnce({
        resources: [
          {
            type: "worker",
            id: "payments-api",
          },
        ],
      })
      .mockResolvedValueOnce({
        resources: [
          {
            type: "worker",
            id: "payments-api",
          },
          {
            type: "worker",
            id: "unmanaged-api",
          },
        ],
      });

    const managementScopeStore: ManagementScopeStore = {
      add: vi.fn(),
      remove: vi.fn(),
      getScope,
    };

    const planningService = createPlanningService(
      stateStore,
      managementScopeStore,
    );

    const firstPlan = await planningService.plan(desired);

    expect(firstPlan.operations).toHaveLength(1);
    expect(firstPlan.operations[0].resource).toEqual({
      type: "worker",
      id: "payments-api",
    });

    const secondPlan = await planningService.plan(desired);

    expect(secondPlan.operations).toHaveLength(2);
    expect(
      secondPlan.operations.map((operation) => operation.resource),
    ).toEqual([
      {
        type: "worker",
        id: "payments-api",
      },
      {
        type: "worker",
        id: "unmanaged-api",
      },
    ]);

    expect(getScope).toHaveBeenCalledTimes(2);
  });
});
