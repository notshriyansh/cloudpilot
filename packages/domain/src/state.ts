import type { ResourceId } from "./resource";

export interface ResourceState {
  resource: ResourceId;
  attributes: Record<string, unknown>;
}

export interface ObservedState {
  resources: ResourceState[];
}

export interface DesiredState {
  resources: ResourceState[];
}

export function resourceIdKey(resource: ResourceId): string {
  return `${resource.type}:${resource.id}`;
}

export function findResource(
  state: ObservedState | DesiredState,
  resource: ResourceId,
): ResourceState | undefined {
  const key = resourceIdKey(resource);

  return state.resources.find(
    (candidate) => resourceIdKey(candidate.resource) === key,
  );
}
