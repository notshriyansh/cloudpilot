import type { ResourceId } from "@cloudpilot/domain";
import type { ManagementScopeStore } from "@cloudpilot/state-store";

export interface ManagementService {
  register(resource: ResourceId): Promise<void>;
  unregister(resource: ResourceId): Promise<void>;
  getScope(): Promise<{ resources: ResourceId[] }>;
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

    async getScope() {
      return managementScopeStore.getScope();
    },
  };
}
