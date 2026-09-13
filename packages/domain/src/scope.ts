import type { ResourceId } from "./resource";
import type { ResourceChange, StateDiff } from "./diff";
import { resourceIdKey } from "./state";

export interface ManagementScope {
  resources: ResourceId[];
}

export function isManaged(
  scope: ManagementScope,
  resource: ResourceId,
): boolean {
  const key = resourceIdKey(resource);

  return scope.resources.some((candidate) => resourceIdKey(candidate) === key);
}

export function filterChangesByScope(
  diff: StateDiff,
  scope: ManagementScope,
): StateDiff {
  const changes: ResourceChange[] = diff.changes.filter((change) => {
    switch (change.type) {
      case "create":
        return isManaged(scope, change.resource.resource);

      case "update":
        return isManaged(scope, change.desired.resource);

      case "delete":
        return isManaged(scope, change.resource.resource);
    }
  });

  return { changes };
}
