import type { EvaluatedPlan } from "./desired-state";
import { buildSafetyContext } from "./safety-context";

export type PlanReviewStatus =
  "empty" | "blocked" | "approval_required" | "review_required" | "ready";

export interface PlanReviewAttention {
  index: number;
  action: string;
  resource: { type: string; id: string };
  heading: string;
  explanation: string;
  tone: "danger" | "warning" | "caution";
}

export interface PlanReviewSummary {
  status: PlanReviewStatus;
  total: number;
  ready: number;
  blocked: number;
  approvalRequired: number;
  attentionItems: PlanReviewAttention[];
  heading: string;
  explanation: string;
}

export function buildPlanReview(evaluation: EvaluatedPlan): PlanReviewSummary {
  const operations = evaluation.operations;

  const blockedOperations = operations.filter(
    (item) =>
      item.readiness === "blocked" ||
      String(item.policy.action ?? "").toLowerCase() === "deny",
  );

  const approvalOperations = operations.filter(
    (item) =>
      item.readiness !== "blocked" &&
      String(item.policy.action ?? "").toLowerCase() !== "deny" &&
      (item.readiness === "approval_required" ||
        String(item.approval.requirement ?? "").toLowerCase() === "required"),
  );

  const attentionItems: PlanReviewAttention[] = operations.flatMap(
    (item, index) => {
      const context = buildSafetyContext(item);

      if (context.tone === "success") {
        return [];
      }

      return [
        {
          index,
          action: item.operation.action,
          resource: item.operation.resource,
          heading: context.heading,
          explanation: context.explanation,
          tone: context.tone,
        },
      ];
    },
  );

  const ready = operations.filter(
    (item) =>
      item.readiness === "ready" &&
      String(item.policy.action ?? "").toLowerCase() !== "deny",
  ).length;

  let status: PlanReviewStatus;
  let heading: string;
  let explanation: string;

  if (operations.length === 0) {
    status = "empty";
    heading = "No proposed operations";
    explanation =
      "The evaluation returned no operations. This does not independently verify the complete infrastructure state.";
  } else if (blockedOperations.length > 0) {
    status = "blocked";
    heading = "Plan has blocked operations";
    explanation =
      "Resolve policy-blocked operations before considering any separately authorized execution.";
  } else if (approvalOperations.length > 0) {
    status = "approval_required";
    heading = "Human approval required";
    explanation =
      "One or more operations require approval. Review their proposed changes and risk before proceeding.";
  } else if (attentionItems.length > 0) {
    status = "review_required";
    heading = "Additional review required";
    explanation =
      "Some operations have elevated risk or incomplete state details. Resolve these concerns before deciding whether to proceed.";
  } else {
    status = "ready";
    heading = "Evaluation checks passed";
    explanation =
      "No blockers, approval requirements, or additional safety concerns were reported by the current checks. This is not an execution record or a guarantee of safety.";
  }

  return {
    status,
    total: operations.length,
    ready,
    blocked: blockedOperations.length,
    approvalRequired: approvalOperations.length,
    attentionItems,
    heading,
    explanation,
  };
}
