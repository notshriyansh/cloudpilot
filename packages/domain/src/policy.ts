import type { EvaluationContext } from "./evaluation-context";
import type { PlanOperation } from "./plan";

export type PolicyAction = "allow" | "deny";

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
}

export interface Policy {
  evaluate(
    operation: PlanOperation,
    context: EvaluationContext,
  ): PolicyDecision;
}

export function createDefaultPolicy(): Policy {
  return {
    evaluate(operation, _context) {
      if (operation.action === "delete" && operation.resource.type === "zone") {
        return {
          action: "deny",
          reason: "Deleting zones is not permitted by the default policy",
        };
      }

      return {
        action: "allow",
        reason: "Operation is permitted by the default policy",
      };
    },
  };
}
