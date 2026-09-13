import type { ManagementScopeStore } from "@cloudpilot/state-store";
import type { ResourceId } from "@cloudpilot/domain";

export interface ManagementService {
  register(resource: ResourceId): Promise<void>;
  unregister(resource: ResourceId): Promise<void>;
}

export function createManagementService(
  managementScopeStore: ManagementScopeStore,
): ManagementService {
  return {
    async register(resource) {
      await managementScopeStore.add(resource);
    },

    async unregister(resource) {
      await managementScopeStore.remove(resource);
    },
  };
}
