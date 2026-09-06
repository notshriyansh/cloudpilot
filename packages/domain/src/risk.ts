import type { PlanOperation } from "./plan";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  level: RiskLevel;
  reason: string;
}

export interface RiskEvaluator {
  assess(operation: PlanOperation): RiskAssessment;
}

export function createDefaultRiskEvaluator(): RiskEvaluator {
  return {
    assess(operation) {
      if (operation.action === "delete" && operation.resource.type === "zone") {
        return {
          level: "critical",
          reason: "Deleting a zone can have a broad infrastructure impact",
        };
      }

      if (
        operation.action === "delete" &&
        operation.resource.type === "dns_record"
      ) {
        return {
          level: "high",
          reason: "Deleting a DNS record can affect traffic routing",
        };
      }

      if (
        operation.action === "update" &&
        operation.resource.type === "dns_record"
      ) {
        return {
          level: "medium",
          reason: "Updating a DNS record can affect traffic routing",
        };
      }

      if (
        operation.action === "create" &&
        operation.resource.type === "dns_record"
      ) {
        return {
          level: "low",
          reason: "Creating a DNS record is a relatively low-risk operation",
        };
      }

      return {
        level: "medium",
        reason: "Infrastructure mutation requires moderate caution",
      };
    },
  };
}
