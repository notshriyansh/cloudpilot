import { describe, expect, it } from "vitest";
import type { EvaluatedOperation, EvaluatedPlan } from "@cloudpilot/domain";
import { buildPolicySummary } from "./policy-summary";

function createOperation(
  overrides: Partial<EvaluatedOperation> = {},
): EvaluatedOperation {
  return {
    operation: {
      action: "create",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [],
    },
    policy: {
      action: "allow",
      reason: "Allowed",
    },
    risk: {
      level: "low",
      reason: "Low risk",
    },
    approval: {
      requirement: "none",
      reason: "No approval required",
    },
    executionSupport: {
      supported: true,
    },
    readiness: "ready",
    ...overrides,
  };
}

function createPlan(operations: EvaluatedOperation[]): EvaluatedPlan {
  return { operations };
}

describe("buildPolicySummary", () => {
  it("returns null when no evaluation exists", () => {
    expect(buildPolicySummary(null)).toBeNull();
  });

  it("returns zero counts for an empty evaluation", () => {
    expect(buildPolicySummary(createPlan([]))).toMatchObject({
      total: 0,
      policy: { allowed: 0, denied: 0 },
      approval: { required: 0, notRequired: 0 },
      readiness: {
        ready: 0,
        blocked: 0,
        approvalRequired: 0,
      },
    });
  });

  it("counts allowed and ready operations", () => {
    const summary = buildPolicySummary(createPlan([createOperation()]));

    expect(summary).toMatchObject({
      total: 1,
      policy: { allowed: 1, denied: 0 },
      approval: { required: 0, notRequired: 1 },
      risk: { low: 1 },
      readiness: { ready: 1 },
      execution: { unsupported: 0 },
    });
  });

  it("distinguishes policy denial from execution support", () => {
    const summary = buildPolicySummary(
      createPlan([
        createOperation({
          policy: {
            action: "deny",
            reason: "Denied",
          },
          readiness: "blocked",
        }),
        createOperation({
          operation: {
            action: "update",
            resource: {
              type: "dns_record",
              id: "record-2",
            },
            dependencies: [],
          },
          executionSupport: {
            supported: false,
            reason: "Unsupported operation",
          },
          readiness: "blocked",
        }),
      ]),
    );

    expect(summary).toMatchObject({
      total: 2,
      policy: { allowed: 1, denied: 1 },
      readiness: { blocked: 2 },
      execution: { unsupported: 1 },
    });
  });

  it("counts approval requirements and all risk levels", () => {
    const summary = buildPolicySummary(
      createPlan([
        createOperation({
          risk: { level: "medium", reason: "Medium" },
        }),
        createOperation({
          risk: { level: "high", reason: "High" },
          approval: {
            requirement: "required",
            reason: "Approval required",
          },
          readiness: "approval_required",
        }),
        createOperation({
          risk: { level: "critical", reason: "Critical" },
          approval: {
            requirement: "required",
            reason: "Approval required",
          },
          readiness: "approval_required",
        }),
      ]),
    );

    expect(summary).toMatchObject({
      risk: {
        low: 0,
        medium: 1,
        high: 1,
        critical: 1,
      },
      approval: {
        required: 2,
        notRequired: 1,
      },
      readiness: {
        ready: 1,
        blocked: 0,
        approvalRequired: 2,
      },
    });
  });
});
