import type { ResourceState } from "./state";
import type { ResourceId } from "./resource";

export type PlanAction = "create" | "update" | "delete";

export interface PlanOperation {
  action: PlanAction;
  resource: ResourceId;
  desired?: ResourceState;
  observed?: ResourceState;
  dependencies: ResourceId[];
}

export interface Plan {
  operations: PlanOperation[];
}
