import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import type { ResourceId } from "@cloudpilot/domain";
import type { ManagementScopeStore } from "@cloudpilot/state-store";

import { createManagementService } from "../src/management";

describe("ManagementService", () => {
  it("registers a resource", async () => {
    const resource: ResourceId = {
      type: "worker",
      id: "fluxion-api",
    };

    const store: ManagementScopeStore = {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      getScope: vi.fn(),
    };

    const service = createManagementService(store);

    await service.register(resource);

    expect(store.add).toHaveBeenCalledOnce();
    expect(store.add).toHaveBeenCalledWith(resource);
  });

  it("unregisters a resource", async () => {
    const resource: ResourceId = {
      type: "worker",
      id: "fluxion-api",
    };

    const store: ManagementScopeStore = {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      getScope: vi.fn(),
    };

    const service = createManagementService(store);

    await service.unregister(resource);

    expect(store.remove).toHaveBeenCalledOnce();
    expect(store.remove).toHaveBeenCalledWith(resource);
  });

  it("wires the management service into the app", async () => {
    const resource: ResourceId = {
      type: "worker",
      id: "fluxion-api",
    };

    const managementScopeStore: ManagementScopeStore = {
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      getScope: vi.fn().mockResolvedValue({
        resources: [],
      }),
    };

    const app = createApp({
      inventory: {
        inspect: vi.fn(),
      },
      stateStore: {
        saveObservation: vi.fn().mockResolvedValue(undefined),
        getLatestObservation: vi.fn().mockResolvedValue(undefined),
      },
      clock: {
        now: () => new Date(),
      },
      idGenerator: {
        generate: () => "test-id",
      },
      managementScopeStore,
    });

    await app.managementService.register(resource);

    expect(managementScopeStore.add).toHaveBeenCalledOnce();
    expect(managementScopeStore.add).toHaveBeenCalledWith(resource);
  });
});
