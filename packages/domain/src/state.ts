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
