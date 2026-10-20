import { describe, expect, it } from "vitest";
import type { EvaluatedOperation } from "@/lib/desired-state";
import { buildSafetyContext } from "./safety-context";

function evaluatedOperation(
  overrides: Partial<EvaluatedOperation> = {},
): EvaluatedOperation {
  return {
    operation: {
      action: "update",
      resource: { type: "worker", id: "payments-api" },
      observed: {
        resource: { type: "worker", id: "payments-api" },
        attributes: { enabled: true },
      },
      desired: {
        resource: { type: "worker", id: "payments-api" },
        attributes: { enabled: false },
      },
      dependencies: [],
    },
    policy: {
      action: "allow",
      reason: "Operation is permitted by the default policy",
    },
    risk: {
      level: "medium",
      reason: "Infrastructure mutation requires moderate caution",
    },
    approval: {
      requirement: "none",
      reason: "Operation does not require human approval",
    },
    readiness: "ready",
    ...overrides,
  };
}

describe("buildSafetyContext", () => {
  it("explains policy denial without suggesting approval can bypass it", () => {
    const context = buildSafetyContext(
      evaluatedOperation({
        policy: {
          action: "deny",
          reason: "Deleting workers is not permitted",
        },
        approval: {
          requirement: "none",
          reason: "Denied operations cannot proceed to approval",
        },
        readiness: "blocked",
      }),
    );

    expect(context.heading).toBe("Blocked by policy");
    expect(context.explanation).toBe("Deleting workers is not permitted");
    expect(context.tone).toBe("danger");
    expect(context.checks).toContain(
      "Do not proceed while this operation is blocked.",
    );
  });

  it("explains required human approval", () => {
    const context = buildSafetyContext(
      evaluatedOperation({
        risk: {
          level: "high",
          reason: "Deleting a DNS record can affect traffic routing",
        },
        approval: {
          requirement: "required",
          reason: "high risk operations require human approval",
        },
        readiness: "approval_required",
      }),
    );

    expect(context.heading).toBe("Human approval required");
    expect(context.explanation).toContain("human approval");
    expect(context.tone).toBe("warning");
  });

  it("flags missing observed state during an update", () => {
    const context = buildSafetyContext(
      evaluatedOperation({
        operation: {
          action: "update",
          resource: { type: "worker", id: "payments-api" },
          desired: {
            resource: { type: "worker", id: "payments-api" },
            attributes: { enabled: false },
          },
          dependencies: [],
        },
      }),
    );

    expect(context.heading).toBe("Review incomplete state");
    expect(context.checks).toContain("Observed resource state is missing.");
  });

  it("flags empty desired attributes during an update", () => {
    const context = buildSafetyContext(
      evaluatedOperation({
        operation: {
          action: "update",
          resource: { type: "worker", id: "payments-api" },
          observed: {
            resource: { type: "worker", id: "payments-api" },
            attributes: { enabled: true },
          },
          desired: {
            resource: { type: "worker", id: "payments-api" },
            attributes: {},
          },
          dependencies: [],
        },
      }),
    );

    expect(context.checks).toContain(
      "Desired state has no attributes to review.",
    );
  });

  it("does not claim that a ready operation has executed", () => {
    const context = buildSafetyContext(evaluatedOperation());

    expect(context.heading).toBe("Evaluation checks passed");
    expect(context.explanation).toContain("It has not been executed");
    expect(context.tone).toBe("success");
  });

  it("flags a missing observed resource before deletion", () => {
    const context = buildSafetyContext(
      evaluatedOperation({
        operation: {
          action: "delete",
          resource: { type: "dns_record", id: "api.example.com" },
          dependencies: [],
        },
      }),
    );

    expect(context.checks).toContain("Observed resource details are missing.");
  });
});
