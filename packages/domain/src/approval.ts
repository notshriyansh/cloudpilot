import type { PolicyDecision } from "./policy";
import type { RiskAssessment, RiskLevel } from "./risk";

export type ApprovalRequirement = "none" | "required";

export interface ApprovalDecision {
  requirement: ApprovalRequirement;
  reason: string;
}

export interface ApprovalEvaluator {
  evaluate(policy: PolicyDecision, risk: RiskAssessment): ApprovalDecision;
}

export function createDefaultApprovalEvaluator(): ApprovalEvaluator {
  return {
    evaluate(policy, risk) {
      if (policy.action === "deny") {
        return {
          requirement: "none",
          reason: "Denied operations cannot proceed to approval",
        };
      }

      if (risk.level === "high" || risk.level === "critical") {
        return {
          requirement: "required",
          reason: `${risk.level} risk operations require human approval`,
        };
      }

      return {
        requirement: "none",
        reason: "Operation does not require human approval",
      };
    },
  };
}
