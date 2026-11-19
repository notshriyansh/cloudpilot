import type { EvaluatedPlan } from "@cloudpilot/domain";

export type PolicySummary = {
  total: number;

  policy: {
    allowed: number;
    denied: number;
  };

  approval: {
    required: number;
    notRequired: number;
  };

  risk: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  readiness: {
    ready: number;
    blocked: number;
    approvalRequired: number;
  };

  execution: {
    unsupported: number;
  };
};

export function buildPolicySummary(
  evaluation: EvaluatedPlan | null,
): PolicySummary | null {
  if (!evaluation) {
    return null;
  }

  const summary: PolicySummary = {
    total: evaluation.operations.length,

    policy: {
      allowed: 0,
      denied: 0,
    },

    approval: {
      required: 0,
      notRequired: 0,
    },

    risk: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },

    readiness: {
      ready: 0,
      blocked: 0,
      approvalRequired: 0,
    },

    execution: {
      unsupported: 0,
    },
  };

  for (const item of evaluation.operations) {
    if (item.policy.action === "allow") {
      summary.policy.allowed++;
    } else {
      summary.policy.denied++;
    }

    if (item.approval.requirement === "required") {
      summary.approval.required++;
    } else {
      summary.approval.notRequired++;
    }

    summary.risk[item.risk.level]++;

    switch (item.readiness) {
      case "ready":
        summary.readiness.ready++;
        break;
      case "blocked":
        summary.readiness.blocked++;
        break;
      case "approval_required":
        summary.readiness.approvalRequired++;
        break;
    }

    if (!item.executionSupport.supported) {
      summary.execution.unsupported++;
    }
  }

  return summary;
}
