import type { ApprovalDecision, ApprovalEvaluator } from "./approval";
import type { EvaluationContext } from "./evaluation-context";
import { analyzeImpact } from "./impact";
import type { Plan, PlanOperation } from "./plan";
import type { Policy, PolicyDecision } from "./policy";
import type { RiskAssessment, RiskEvaluator } from "./risk";
import { resourceIdKey } from "./state";

export interface EvaluatedOperation {
  operation: PlanOperation;
  policy: PolicyDecision;
  risk: RiskAssessment;
  approval: ApprovalDecision;
  readiness: ExecutionReadiness;
}

export interface EvaluatedPlan {
  operations: EvaluatedOperation[];
}

export interface PlanEvaluator {
  evaluate(plan: Plan): EvaluatedPlan;
}

export type ExecutionReadiness = "ready" | "blocked" | "approval_required";

export function createPlanEvaluator(
  policy: Policy,
  riskEvaluator: RiskEvaluator,
  approvalEvaluator: ApprovalEvaluator,
): PlanEvaluator {
  return {
    evaluate(plan) {
      const impact = new Map(
        plan.operations.map((operation) => [
          resourceIdKey(operation.resource),
          analyzeImpact(operation, plan),
        ]),
      );

      const context: EvaluationContext = {
        plan,
        impact,
      };

      return {
        operations: plan.operations.map((operation) =>
          evaluateOperation(
            operation,
            context,
            policy,
            riskEvaluator,
            approvalEvaluator,
          ),
        ),
      };
    },
  };
}

function determineExecutionReadiness(
  policy: PolicyDecision,
  approval: ApprovalDecision,
): ExecutionReadiness {
  if (policy.action === "deny") {
    return "blocked";
  }

  if (approval.requirement === "required") {
    return "approval_required";
  }

  return "ready";
}

function evaluateOperation(
  operation: PlanOperation,
  context: EvaluationContext,
  policy: Policy,
  riskEvaluator: RiskEvaluator,
  approvalEvaluator: ApprovalEvaluator,
): EvaluatedOperation {
  const policyDecision = policy.evaluate(operation, context);
  const riskAssessment = riskEvaluator.assess(operation, context);
  const approvalDecision = approvalEvaluator.evaluate(
    policyDecision,
    riskAssessment,
  );

  const readiness = determineExecutionReadiness(
    policyDecision,
    approvalDecision,
  );

  return {
    operation,
    policy: policyDecision,
    risk: riskAssessment,
    approval: approvalDecision,
    readiness,
  };
}
