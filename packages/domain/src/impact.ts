import type { Plan, PlanOperation } from "./plan";
import type { ResourceId } from "./resource";
import { resourceIdKey } from "./state";

export interface ImpactAnalysis {
  resources: ResourceId[];
}

export function analyzeImpact(
  operation: PlanOperation,
  plan: Plan,
): ImpactAnalysis {
  const resources = new Map<string, ResourceId>();

  resources.set(resourceIdKey(operation.resource), operation.resource);

  for (const candidate of plan.operations) {
    const dependsOnOperation = candidate.dependencies.some(
      (dependency) =>
        resourceIdKey(dependency) === resourceIdKey(operation.resource),
    );

    if (dependsOnOperation) {
      resources.set(resourceIdKey(candidate.resource), candidate.resource);
    }
  }

  return {
    resources: [...resources.values()].sort((left, right) =>
      resourceIdKey(left).localeCompare(resourceIdKey(right)),
    ),
  };
}
