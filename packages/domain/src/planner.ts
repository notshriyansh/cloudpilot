import { buildOperationGraph, topologicalOrderOperations } from "./graph";
import { resourceIdKey } from "./state";
import type { Plan, PlanOperation } from "./plan";
import type { StateDiff } from "./diff";
import type { ResourceGraph } from "./graph";

export function createPlan(diff: StateDiff, graph: ResourceGraph): Plan {
  const operations: PlanOperation[] = [];

  for (const change of diff.changes) {
    switch (change.type) {
      case "create": {
        const key = resourceIdKey(change.resource.resource);

        operations.push({
          action: "create",
          resource: change.resource.resource,
          desired: change.resource,
          dependencies: graph.dependencies.get(key) ?? [],
        });

        break;
      }

      case "update": {
        const key = resourceIdKey(change.desired.resource);

        operations.push({
          action: "update",
          resource: change.desired.resource,
          desired: change.desired,
          observed: change.observed,
          dependencies: graph.dependencies.get(key) ?? [],
        });

        break;
      }

      case "delete": {
        const key = resourceIdKey(change.resource.resource);

        operations.push({
          action: "delete",
          resource: change.resource.resource,
          observed: change.resource,
          dependencies: graph.dependencies.get(key) ?? [],
        });

        break;
      }
    }
  }

  const operationGraph = buildOperationGraph(operations);
  const orderedResources = topologicalOrderOperations(operationGraph);

  const operationByKey = new Map(
    operations.map((operation) => [
      resourceIdKey(operation.resource),
      operation,
    ]),
  );

  return {
    operations: orderedResources
      .map((resource) => operationByKey.get(resourceIdKey(resource)))
      .filter(
        (operation): operation is PlanOperation => operation !== undefined,
      ),
  };
}
