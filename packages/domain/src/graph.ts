import type { ResourceId } from "./resource";
import { resourceIdKey } from "./state";
import type { ResourceState } from "./state";

export interface ResourceGraph {
  resources: ResourceId[];
  dependencies: Map<string, ResourceId[]>;
}

export class ResourceGraphCycleError extends Error {
  constructor() {
    super("Resource graph contains a dependency cycle");
    this.name = "ResourceGraphCycleError";
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

export function topologicalOrder(graph: ResourceGraph): ResourceId[] {
  const resourceByKey = new Map(
    graph.resources.map((resource) => [resourceIdKey(resource), resource]),
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
      throw new ResourceGraphCycleError();
    }

    visiting.add(key);

    for (const dependency of graph.dependencies.get(key) ?? []) {
      if (resourceByKey.has(resourceIdKey(dependency))) {
        visit(dependency);
      }
    }

    visiting.delete(key);
    visited.add(key);
    ordered.push(resource);
  }

  const resources = [...graph.resources].sort((left, right) =>
    resourceIdKey(left).localeCompare(resourceIdKey(right)),
  );

  for (const resource of resources) {
    visit(resource);
  }

  return ordered;
}
