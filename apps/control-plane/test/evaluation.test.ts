import { describe, expect, it, vi } from "vitest";

import type {
  DesiredState,
  EvaluatedPlan,
  Plan,
  PlanEvaluator,
} from "@cloudpilot/domain";

import {
  createEvaluationService,
  type EvaluationService,
} from "../src/evaluation";

describe("EvaluationService", () => {
  const desired: DesiredState = {
    resources: [
      {
        resource: {
          type: "worker",
          id: "payments-api",
        },
        attributes: {},
      },
    ],
  };

  const plan: Plan = {
    operations: [
      {
        action: "create",
        resource: {
          type: "worker",
          id: "payments-api",
        },
        dependencies: [],
      },
    ],
  };

  const evaluatedPlan: EvaluatedPlan = {
    operations: [
      {
        operation: plan.operations[0],
        policy: {
          action: "allow",
          reason: "Operation is permitted",
        },
        risk: {
          level: "low",
          reason: "Low risk operation",
        },
        approval: {
          requirement: "none",
          reason: "Operation does not require human approval",
        },
        readiness: "ready",
      },
    ],
  };

  it("plans the desired state and evaluates the resulting plan", async () => {
    const planMock = vi.fn().mockResolvedValue(plan);
    const evaluateMock = vi.fn().mockReturnValue(evaluatedPlan);

    const planningService = {
      plan: planMock,
    };

    const planEvaluator: PlanEvaluator = {
      evaluate: evaluateMock,
    };

    const service: EvaluationService = createEvaluationService(
      planningService,
      planEvaluator,
    );

    const result = await service.evaluate(desired);

    expect(result).toEqual(evaluatedPlan);

    expect(planMock).toHaveBeenCalledOnce();
    expect(planMock).toHaveBeenCalledWith(desired);

    expect(evaluateMock).toHaveBeenCalledOnce();
    expect(evaluateMock).toHaveBeenCalledWith(plan);
  });

  it("propagates planning failures", async () => {
    const error = new Error("Planning failed");

    const planMock = vi.fn().mockRejectedValue(error);
    const evaluateMock = vi.fn();

    const planningService = {
      plan: planMock,
    };

    const planEvaluator: PlanEvaluator = {
      evaluate: evaluateMock,
    };

    const service = createEvaluationService(planningService, planEvaluator);

    await expect(service.evaluate(desired)).rejects.toThrow("Planning failed");

    expect(planMock).toHaveBeenCalledOnce();
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it("propagates evaluation failures", async () => {
    const error = new Error("Evaluation failed");

    const planMock = vi.fn().mockResolvedValue(plan);
    const evaluateMock = vi.fn().mockImplementation(() => {
      throw error;
    });

    const planningService = {
      plan: planMock,
    };

    const planEvaluator: PlanEvaluator = {
      evaluate: evaluateMock,
    };

    const service = createEvaluationService(planningService, planEvaluator);

    await expect(service.evaluate(desired)).rejects.toThrow(
      "Evaluation failed",
    );

    expect(planMock).toHaveBeenCalledOnce();
    expect(evaluateMock).toHaveBeenCalledOnce();
  });

  it("passes the exact planned object to the evaluator", async () => {
    const plannedObject: Plan = {
      operations: [
        {
          action: "update",
          resource: {
            type: "worker",
            id: "api",
          },
          dependencies: [],
        },
      ],
    };

    const planMock = vi.fn().mockResolvedValue(plannedObject);
    const evaluateMock = vi.fn().mockReturnValue({
      operations: [],
    } satisfies EvaluatedPlan);

    const planningService = {
      plan: planMock,
    };

    const planEvaluator: PlanEvaluator = {
      evaluate: evaluateMock,
    };

    const service = createEvaluationService(planningService, planEvaluator);

    await service.evaluate(desired);

    expect(evaluateMock).toHaveBeenCalledWith(plannedObject);
    expect(evaluateMock.mock.calls[0][0]).toBe(plannedObject);
  });
});
