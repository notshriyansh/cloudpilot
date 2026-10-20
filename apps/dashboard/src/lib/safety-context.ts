import type { EvaluatedOperation } from "@/lib/desired-state";

export type SafetyTone = "danger" | "warning" | "caution" | "success";

export interface SafetyContext {
  heading: string;
  explanation: string;
  tone: SafetyTone;
  checks: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStateAttributes(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRecord(value.attributes) &&
    Object.keys(value.attributes).length > 0
  );
}

export function buildSafetyContext(item: EvaluatedOperation): SafetyContext {
  const { operation } = item;
  const policyAction = String(item.policy.action ?? "unknown");
  const riskLevel = String(item.risk.level ?? "unknown");
  const approvalRequirement = String(item.approval.requirement ?? "unknown");

  const checks: string[] = [];

  if (operation.action === "create" && !operation.desired) {
    checks.push("Desired resource details are missing.");
  }

  if (operation.action === "update") {
    if (!operation.observed) {
      checks.push("Observed resource state is missing.");
    } else if (!hasStateAttributes(operation.observed)) {
      checks.push("Observed state has no attributes to review.");
    }

    if (!operation.desired) {
      checks.push("Desired resource details are missing.");
    } else if (!hasStateAttributes(operation.desired)) {
      checks.push("Desired state has no attributes to review.");
    }
  }

  if (operation.action === "delete") {
    if (!operation.observed) {
      checks.push("Observed resource details are missing.");
    } else if (!hasStateAttributes(operation.observed)) {
      checks.push("Observed state has no attributes to review.");
    }
  }

  if (policyAction === "deny" || item.readiness === "blocked") {
    return {
      heading: "Blocked by policy",
      explanation: String(
        item.policy.reason ??
          "The current policy evaluation does not permit this operation.",
      ),
      tone: "danger",
      checks: ["Do not proceed while this operation is blocked.", ...checks],
    };
  }

  if (
    approvalRequirement === "required" ||
    item.readiness === "approval_required"
  ) {
    return {
      heading: "Human approval required",
      explanation: String(
        item.approval.reason ??
          "This operation requires approval before it can proceed.",
      ),
      tone: "warning",
      checks: [
        "Review the proposed change and its risk before approving.",
        ...checks,
      ],
    };
  }

  if (riskLevel === "critical" || riskLevel === "high") {
    return {
      heading: "Elevated risk",
      explanation: String(
        item.risk.reason ?? "This operation has elevated risk.",
      ),
      tone: "warning",
      checks: ["Verify the target resource and potential impact.", ...checks],
    };
  }

  if (checks.length > 0) {
    return {
      heading: "Review incomplete state",
      explanation:
        "The current evaluation may not include enough resource detail for a confident review.",
      tone: "caution",
      checks,
    };
  }

  return {
    heading: "Evaluation checks passed",
    explanation:
      "This operation passed the current policy and approval checks. It has not been executed, and successful infrastructure changes have not been verified.",
    tone: "success",
    checks: [
      "Review the proposed change before any separately authorized execution.",
    ],
  };
}
