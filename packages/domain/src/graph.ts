import type { PlanAction, PlanOperation } from "./plan";
import type { ResourceId } from "./resource";
import { resourceIdKey } from "./state";
import type { ResourceState } from "./state";

export interface ResourceGraph {
  resources: ResourceId[];
  dependencies: Map<string, ResourceId[]>;
}

export interface OperationGraph {
  operations: ResourceId[];
  dependencies: Map<string, ResourceId[]>;
}

export class ResourceGraphCycleError extends Error {
  constructor() {
    super("Resource graph contains a dependency cycle");
    this.name = "ResourceGraphCycleError";
  }
}

export class OperationGraphCycleError extends Error {
  constructor() {
    super("Operation graph contains a dependency cycle");
    this.name = "OperationGraphCycleError";
  }
}

export function buildResourceGraph(resources: ResourceState[]): ResourceGraph {
  const graph: ResourceGraph = {
    resources: resources.map((resource) => resource.resource),
    dependencies: new Map(),
  };

  for (const resource of resources) {
    const key = resourceIdKey(resource.resource);

    const dependencies =
      resource.relationships
        ?.filter((relationship) => relationship.type === "belongs_to")
        .map((relationship) => relationship.resource) ?? [];

    graph.dependencies.set(key, dependencies);
  }

  return graph;
}

export function getDependents(
  graph: ResourceGraph,
  resource: ResourceId,
): ResourceId[] {
  const targetKey = resourceIdKey(resource);

  return graph.resources
    .filter((candidate) => {
      const dependencies =
        graph.dependencies.get(resourceIdKey(candidate)) ?? [];

      return dependencies.some(
        (dependency) => resourceIdKey(dependency) === targetKey,
      );
    })
    .sort((left, right) =>
      resourceIdKey(left).localeCompare(resourceIdKey(right)),
    );
}

export function topologicalOrder(graph: ResourceGraph): ResourceId[] {
  return topologicalOrderGraph(
    graph.resources,
    graph.dependencies,
    () => new ResourceGraphCycleError(),
  );
}

export function buildOperationGraph(
  operations: PlanOperation[],
): OperationGraph {
  const graph: OperationGraph = {
    operations: operations.map((operation) => operation.resource),
    dependencies: new Map(),
  };

  const operationByKey = new Map(
    operations.map((operation) => [
      resourceIdKey(operation.resource),
      operation,
    ]),
  );

  for (const operation of operations) {
    graph.dependencies.set(resourceIdKey(operation.resource), []);
  }

  for (const operation of operations) {
    const operationKey = resourceIdKey(operation.resource);

    for (const dependency of operation.dependencies) {
      const dependencyOperation = operationByKey.get(resourceIdKey(dependency));

      if (!dependencyOperation) {
        continue;
      }

      const dependencyKey = resourceIdKey(dependencyOperation.resource);

      if (
        operation.action === "delete" &&
        dependencyOperation.action === "delete"
      ) {
        const operationDependencies =
          graph.dependencies.get(operationKey) ?? [];

        const dependencyDependencies =
          graph.dependencies.get(dependencyKey) ?? [];

        dependencyDependencies.push(operation.resource);

        graph.dependencies.set(operationKey, operationDependencies);
        graph.dependencies.set(dependencyKey, dependencyDependencies);
      } else {
        const operationDependencies =
          graph.dependencies.get(operationKey) ?? [];

        operationDependencies.push(dependencyOperation.resource);

        graph.dependencies.set(operationKey, operationDependencies);
      }
    }
  }

  return graph;
}

export function topologicalOrderOperations(
  graph: OperationGraph,
): ResourceId[] {
  return topologicalOrderGraph(
    graph.operations,
    graph.dependencies,
    () => new OperationGraphCycleError(),
  );
}

function topologicalOrderGraph(
  resources: ResourceId[],
  dependencies: Map<string, ResourceId[]>,
  createCycleError: () => Error,
): ResourceId[] {
  const resourceByKey = new Map(
    resources.map((resource) => [resourceIdKey(resource), resource]),
  );

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: ResourceId[] = [];

  function visit(resource: ResourceId): void {
    const key = resourceIdKey(resource);

    if (visited.has(key)) {
      return;
    }

    if (visiting.has(key)) {
      throw createCycleError();
    }

    visiting.add(key);

    for (const dependency of dependencies.get(key) ?? []) {
      if (resourceByKey.has(resourceIdKey(dependency))) {
        visit(dependency);
      }
    }

    visiting.delete(key);
    visited.add(key);
    ordered.push(resource);
  }

  const sortedResources = [...resources].sort((left, right) =>
    resourceIdKey(left).localeCompare(resourceIdKey(right)),
  );

  for (const resource of sortedResources) {
    visit(resource);
  }

  return ordered;
}
