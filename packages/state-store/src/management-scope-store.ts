import type { ManagementScope, ResourceId } from "@cloudpilot/domain";

export interface ManagementScopeStore {
  add(resource: ResourceId): Promise<void>;
  remove(resource: ResourceId): Promise<void>;
  getScope(): Promise<ManagementScope>;
}
