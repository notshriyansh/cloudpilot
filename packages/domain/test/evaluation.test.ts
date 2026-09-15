import { describe, expect, it } from "vitest";
import { createDefaultApprovalEvaluator } from "../src/approval";
import { createPlanEvaluator } from "../src/evaluation";
import type { Plan, PlanOperation } from "../src/plan";
import { createDefaultPolicy } from "../src/policy";
import { createDefaultRiskEvaluator } from "../src/risk";
import type { EvaluationContext } from "../src/evaluation-context";

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

  it("blocks a policy-denied operation regardless of its risk", () => {
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
    const operation = result.operations[0];

    expect(operation.policy.action).toBe("deny");
    expect(operation.risk.level).toBe("critical");
    expect(operation.approval.requirement).toBe("none");
    expect(operation.readiness).toBe("blocked");
  });

  it("requires approval for an allowed high-risk operation", () => {
    const plan: Plan = {
      operations: [
        {
          action: "delete",
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          dependencies: [],
        },
      ],
    };

    const result = evaluator.evaluate(plan);
    const operation = result.operations[0];

    expect(operation.policy.action).toBe("allow");
    expect(operation.risk.level).toBe("high");
    expect(operation.approval.requirement).toBe("required");
    expect(operation.readiness).toBe("approval_required");
  });

  it("marks an allowed low-risk operation as ready", () => {
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
      ],
    };

    const result = evaluator.evaluate(plan);
    const operation = result.operations[0];

    expect(operation.policy.action).toBe("allow");
    expect(operation.risk.level).toBe("low");
    expect(operation.approval.requirement).toBe("none");
    expect(operation.readiness).toBe("ready");
  });

  it("marks an allowed medium-risk operation as ready", () => {
    const plan: Plan = {
      operations: [
        {
          action: "update",
          resource: {
            type: "worker",
            id: "worker-1",
          },
          dependencies: [],
        },
      ],
    };

    const result = evaluator.evaluate(plan);
    const operation = result.operations[0];

    expect(operation.policy.action).toBe("allow");
    expect(operation.risk.level).toBe("medium");
    expect(operation.approval.requirement).toBe("none");
    expect(operation.readiness).toBe("ready");
  });

  it("passes the complete plan as evaluation context", () => {
    const plan: Plan = {
      operations: [
        {
          action: "create",
          resource: {
            type: "worker",
            id: "worker-1",
          },
          dependencies: [],
        },
        {
          action: "update",
          resource: {
            type: "dns_record",
            id: "record-1",
          },
          dependencies: [],
        },
      ],
    };

    let receivedPolicyContext: unknown;
    let receivedRiskContext: unknown;

    const policy = {
      evaluate(_operation: PlanOperation, context: EvaluationContext) {
        receivedPolicyContext = context;

        return {
          action: "allow" as const,
          reason: "test",
        };
      },
    };

    const riskEvaluator = {
      assess(_operation: PlanOperation, context: EvaluationContext) {
        receivedRiskContext = context;

        return {
          level: "low" as const,
          reason: "test",
        };
      },
    };

    const evaluator = createPlanEvaluator(
      policy,
      riskEvaluator,
      createDefaultApprovalEvaluator(),
    );

    evaluator.evaluate(plan);

    expect(receivedPolicyContext).toEqual({ plan });
    expect(receivedRiskContext).toEqual({ plan });
  });
});
