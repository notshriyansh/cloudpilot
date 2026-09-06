import { describe, expect, it } from "vitest";
import type { PolicyDecision } from "../src/policy";
import type { RiskAssessment } from "../src/risk";
import { createDefaultApprovalEvaluator } from "../src/approval";

describe("default approval evaluator", () => {
  const evaluator = createDefaultApprovalEvaluator();

  it("does not require approval for an allowed low-risk operation", () => {
    const policy: PolicyDecision = {
      action: "allow",
      reason: "Operation is permitted",
    };

    const risk: RiskAssessment = {
      level: "low",
      reason: "Low risk operation",
    };

    expect(evaluator.evaluate(policy, risk)).toEqual({
      requirement: "none",
      reason: "Operation does not require human approval",
    });
  });

  it("does not require approval for an allowed medium-risk operation", () => {
    const policy: PolicyDecision = {
      action: "allow",
      reason: "Operation is permitted",
    };

    const risk: RiskAssessment = {
      level: "medium",
      reason: "Medium risk operation",
    };

    expect(evaluator.evaluate(policy, risk)).toEqual({
      requirement: "none",
      reason: "Operation does not require human approval",
    });
  });

  it("requires approval for an allowed high-risk operation", () => {
    const policy: PolicyDecision = {
      action: "allow",
      reason: "Operation is permitted",
    };

    const risk: RiskAssessment = {
      level: "high",
      reason: "High risk operation",
    };

    expect(evaluator.evaluate(policy, risk)).toEqual({
      requirement: "required",
      reason: "high risk operations require human approval",
    });
  });

  it("requires approval for an allowed critical-risk operation", () => {
    const policy: PolicyDecision = {
      action: "allow",
      reason: "Operation is permitted",
    };

    const risk: RiskAssessment = {
      level: "critical",
      reason: "Critical risk operation",
    };

    expect(evaluator.evaluate(policy, risk)).toEqual({
      requirement: "required",
      reason: "critical risk operations require human approval",
    });
  });

  it("does not allow approval to override a denied policy", () => {
    const policy: PolicyDecision = {
      action: "deny",
      reason: "Operation is forbidden",
    };

    const risk: RiskAssessment = {
      level: "critical",
      reason: "Critical risk operation",
    };

    expect(evaluator.evaluate(policy, risk)).toEqual({
      requirement: "none",
      reason: "Denied operations cannot proceed to approval",
    });
  });
});
