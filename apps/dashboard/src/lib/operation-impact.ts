import type { EvaluatedOperation } from "@/lib/desired-state";

export interface RelatedOperation {
  index: number;
  action: EvaluatedOperation["operation"]["action"];
  resource: EvaluatedOperation["operation"]["resource"];
  relationship: "before" | "after";
}

export interface OperationImpact {
  prerequisites: RelatedOperation[];
  unresolvedDependencies: EvaluatedOperation["operation"]["dependencies"];
  downstreamOperations: RelatedOperation[];
  position: number;
  totalOperations: number;
}

function resourceKey(resource: { type: string; id: string }): string {
  return JSON.stringify([resource.type, resource.id]);
}

function dependencyRelationship(
  currentAction: EvaluatedOperation["operation"]["action"],
  dependencyAction: EvaluatedOperation["operation"]["action"],
): "before" | "after" {
  return currentAction === "delete" && dependencyAction === "delete"
    ? "after"
    : "before";
}

function downstreamRelationship(
  currentAction: EvaluatedOperation["operation"]["action"],
  dependentAction: EvaluatedOperation["operation"]["action"],
): "before" | "after" {
  return currentAction === "delete" && dependentAction === "delete"
    ? "before"
    : "after";
}

export function buildOperationImpact(
  item: EvaluatedOperation,
  operations: EvaluatedOperation[],
): OperationImpact {
  const targetKey = resourceKey(item.operation.resource);

  const prerequisites = item.operation.dependencies.flatMap((dependency) => {
    const index = operations.findIndex(
      (candidate) =>
        resourceKey(candidate.operation.resource) === resourceKey(dependency),
    );

    if (index < 0) return [];

    const related = operations[index];

    return [
      {
        index,
        action: related.operation.action,
        resource: related.operation.resource,
        relationship: dependencyRelationship(
          item.operation.action,
          related.operation.action,
        ),
      },
    ];
  });

  const unresolvedDependencies = item.operation.dependencies.filter(
    (dependency) =>
      !operations.some(
        (candidate) =>
          resourceKey(candidate.operation.resource) === resourceKey(dependency),
      ),
  );

  const downstreamOperations = operations.flatMap((candidate, index) => {
    if (
      resourceKey(candidate.operation.resource) === targetKey ||
      !candidate.operation.dependencies.some(
        (dependency) => resourceKey(dependency) === targetKey,
      )
    ) {
      return [];
    }

    return [
      {
        index,
        action: candidate.operation.action,
        resource: candidate.operation.resource,
        relationship: downstreamRelationship(
          item.operation.action,
          candidate.operation.action,
        ),
      },
    ];
  });

  const position = operations.findIndex(
    (candidate) => resourceKey(candidate.operation.resource) === targetKey,
  );

  return {
    prerequisites: prerequisites.sort((a, b) => a.index - b.index),
    unresolvedDependencies,
    downstreamOperations: downstreamOperations.sort(
      (a, b) => a.index - b.index,
    ),
    position: position >= 0 ? position + 1 : 0,
    totalOperations: operations.length,
  };
}
