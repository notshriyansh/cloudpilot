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
  executionSupport: ExecutionSupport;
  readiness: ExecutionReadiness;
}

export interface EvaluatedPlan {
  operations: EvaluatedOperation[];
}

export interface PlanEvaluator {
  evaluate(plan: Plan): EvaluatedPlan;
}

export type ExecutionReadiness = "ready" | "blocked" | "approval_required";

export interface ExecutionSupport {
  supported: boolean;
  reason?: string;
}

export type ExecutionCapability = (
  operation: PlanOperation,
) => ExecutionSupport;

export function createPlanEvaluator(
  policy: Policy,
  riskEvaluator: RiskEvaluator,
  approvalEvaluator: ApprovalEvaluator,
  executionCapability: ExecutionCapability = () => ({ supported: true }),
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
            executionCapability,
          ),
        ),
      };
    },
  };
}

function determineExecutionReadiness(
  policy: PolicyDecision,
  approval: ApprovalDecision,
  executionSupport: ExecutionSupport,
): ExecutionReadiness {
  if (policy.action === "deny" || !executionSupport.supported) {
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
  executionCapability: ExecutionCapability,
): EvaluatedOperation {
  const policyDecision = policy.evaluate(operation, context);
  const riskAssessment = riskEvaluator.assess(operation, context);
  const approvalDecision = approvalEvaluator.evaluate(
    policyDecision,
    riskAssessment,
  );

  const executionSupport = executionCapability(operation);

  const readiness = determineExecutionReadiness(
    policyDecision,
    approvalDecision,
    executionSupport,
  );

  return {
    operation,
    policy: policyDecision,
    risk: riskAssessment,
    approval: approvalDecision,
    executionSupport,
    readiness,
  };
}
