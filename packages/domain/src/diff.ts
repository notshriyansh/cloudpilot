import type { DesiredState, ObservedState, ResourceState } from "./state";
import { resourceIdKey } from "./state";
import { areRelationshipsEqual, areValuesEqual } from "./compare";

export type ResourceChange =
  | {
      type: "create";
      resource: ResourceState;
    }
  | {
      type: "update";
      desired: ResourceState;
      observed: ResourceState;
    }
  | {
      type: "delete";
      resource: ResourceState;
    };

export interface StateDiff {
  changes: ResourceChange[];
}

function workerAttributesEqual(
  desired: Record<string, unknown>,
  observed: Record<string, unknown>,
): boolean {
  return Object.entries(desired).every(([key, value]) => {
    return (
      Object.prototype.hasOwnProperty.call(observed, key) &&
      areValuesEqual(value, observed[key])
    );
  });
}

function resourceStateEqual(
  desired: ResourceState,
  observed: ResourceState,
): boolean {
  const attributesEqual =
    desired.resource.type === "worker" && observed.resource.type === "worker"
      ? workerAttributesEqual(desired.attributes, observed.attributes)
      : areValuesEqual(desired.attributes, observed.attributes);

  return (
    attributesEqual &&
    areRelationshipsEqual(desired.relationships, observed.relationships)
  );
}

export function diffStates(
  desired: DesiredState,
  observed: ObservedState,
): StateDiff {
  const changes: ResourceChange[] = [];

  const observedById = new Map<string, ResourceState>(
    observed.resources.map((resource) => [
      resourceIdKey(resource.resource),
      resource,
    ]),
  );

  const desiredById = new Map<string, ResourceState>(
    desired.resources.map((resource) => [
      resourceIdKey(resource.resource),
      resource,
    ]),
  );

  for (const desiredResource of desired.resources) {
    const key = resourceIdKey(desiredResource.resource);
    const observedResource = observedById.get(key);

    if (observedResource === undefined) {
      changes.push({
        type: "create",
        resource: desiredResource,
      });
      continue;
    }

    if (!resourceStateEqual(desiredResource, observedResource)) {
      changes.push({
        type: "update",
        desired: desiredResource,
        observed: observedResource,
      });
    }
  }

  for (const observedResource of observed.resources) {
    const key = resourceIdKey(observedResource.resource);

    if (!desiredById.has(key)) {
      changes.push({
        type: "delete",
        resource: observedResource,
      });
    }
  }

  return {
    changes,
  };
}
