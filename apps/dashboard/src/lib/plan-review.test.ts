import { describe, expect, it } from "vitest";
import type { EvaluatedOperation, EvaluatedPlan } from "@/lib/desired-state";
import { buildPlanReview } from "./plan-review";

function makeOperation(
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
    policy: { action: "allow", reason: "Allowed by policy" },
    risk: { level: "medium", reason: "Moderate risk" },
    approval: { requirement: "none", reason: "No approval required" },
    readiness: "ready",
    ...overrides,
  };
}

function makePlan(operations: EvaluatedOperation[]): EvaluatedPlan {
  return { operations };
}

describe("buildPlanReview", () => {
  it("handles an empty plan without claiming infrastructure is empty", () => {
    const summary = buildPlanReview(makePlan([]));

    expect(summary.status).toBe("empty");
    expect(summary.total).toBe(0);
    expect(summary.explanation).toContain("does not independently verify");
  });

  it("prioritizes blocked operations", () => {
    const summary = buildPlanReview(
      makePlan([
        makeOperation({
          readiness: "blocked",
          policy: { action: "deny", reason: "Denied by policy" },
        }),
      ]),
    );

    expect(summary.status).toBe("blocked");
    expect(summary.blocked).toBe(1);
    expect(summary.attentionItems[0].heading).toBe("Blocked by policy");
  });

  it("identifies operations requiring approval", () => {
    const summary = buildPlanReview(
      makePlan([
        makeOperation({
          readiness: "approval_required",
          approval: {
            requirement: "required",
            reason: "Approval is needed",
          },
        }),
      ]),
    );

    expect(summary.status).toBe("approval_required");
    expect(summary.approvalRequired).toBe(1);
  });

  it("requires additional review when resource state is incomplete", () => {
    const summary = buildPlanReview(
      makePlan([
        makeOperation({
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
      ]),
    );

    expect(summary.status).toBe("review_required");
    expect(summary.attentionItems[0].heading).toBe("Review incomplete state");
  });

  it("reports a clean evaluation without claiming execution succeeded", () => {
    const summary = buildPlanReview(makePlan([makeOperation()]));

    expect(summary.status).toBe("ready");
    expect(summary.ready).toBe(1);
    expect(summary.attentionItems).toHaveLength(0);
    expect(summary.explanation).toContain("not an execution record");
  });

  it("prioritizes blockers over approval requirements", () => {
    const summary = buildPlanReview(
      makePlan([
        makeOperation({
          readiness: "blocked",
          policy: { action: "deny", reason: "Denied" },
        }),
        makeOperation({
          operation: {
            action: "delete",
            resource: { type: "dns_record", id: "api.example.com" },
            observed: {
              resource: {
                type: "dns_record",
                id: "api.example.com",
              },
              attributes: { content: "192.0.2.10" },
            },
            dependencies: [],
          },
          readiness: "approval_required",
          approval: {
            requirement: "required",
            reason: "Approval is needed",
          },
        }),
      ]),
    );

    expect(summary.status).toBe("blocked");
    expect(summary.blocked).toBe(1);
    expect(summary.approvalRequired).toBe(1);
  });
});
