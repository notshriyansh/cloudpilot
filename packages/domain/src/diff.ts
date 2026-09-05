import type { DesiredState, ObservedState, ResourceState } from "./state";
import { resourceIdKey } from "./state";

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

function attributesEqual(
  desired: ResourceState,
  observed: ResourceState,
): boolean {
  return (
    JSON.stringify(desired.attributes) === JSON.stringify(observed.attributes)
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

    if (!attributesEqual(desiredResource, observedResource)) {
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
