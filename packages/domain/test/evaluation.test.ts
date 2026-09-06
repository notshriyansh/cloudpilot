import { describe, expect, it } from "vitest";
import { createDefaultApprovalEvaluator } from "../src/approval";
import { createPlanEvaluator } from "../src/evaluation";
import type { Plan } from "../src/plan";
import { createDefaultPolicy } from "../src/policy";
import { createDefaultRiskEvaluator } from "../src/risk";

describe("plan evaluation", () => {
  const evaluator = createPlanEvaluator(
    createDefaultPolicy(),
    createDefaultRiskEvaluator(),
    createDefaultApprovalEvaluator(),
  );

  it("evaluates every operation in a plan", () => {
    const plan: Plan = {
      operations: [
        {
          action: "create",
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          dependencies: [],
        },
        {
          action: "delete",
          resource: {
            type: "dns_record",
            id: "record-2",
          },
          dependencies: [],
        },
      ],
    };

    const result = evaluator.evaluate(plan);

    expect(result.operations).toHaveLength(2);

    expect(result.operations[0]).toMatchObject({
      operation: plan.operations[0],
      policy: {
        action: "allow",
      },
      risk: {
        level: "low",
      },
      approval: {
        requirement: "none",
      },
      readiness: "ready",
    });

    expect(result.operations[1]).toMatchObject({
      operation: plan.operations[1],
      policy: {
        action: "allow",
      },
      risk: {
        level: "high",
      },
      approval: {
        requirement: "required",
      },
      readiness: "approval_required",
    });
  });

  it("preserves denied operations as denied", () => {
    const plan: Plan = {
      operations: [
        {
          action: "delete",
          resource: {
            type: "zone",
            id: "zone-1",
          },
          dependencies: [],
        },
      ],
    };

    const result = evaluator.evaluate(plan);

    expect(result.operations[0]).toMatchObject({
      policy: {
        action: "deny",
      },
      risk: {
        level: "critical",
      },
      approval: {
        requirement: "none",
      },
      readiness: "blocked",
    });
  });

  it("preserves plan operation ordering", () => {
    const plan: Plan = {
      operations: [
        {
          action: "create",
          resource: {
            type: "dns_record",
            id: "record-a",
          },
          dependencies: [],
        },
        {
          action: "update",
          resource: {
            type: "worker",
            id: "worker-a",
          },
          dependencies: [],
        },
      ],
    };

    const result = evaluator.evaluate(plan);

    expect(
      result.operations.map(({ operation }) => operation.resource.id),
    ).toEqual(["record-a", "worker-a"]);
  });
});
