import { describe, expect, it } from "vitest";
import type { ManagementScope, ResourceId } from "@cloudpilot/domain";
import type { ManagementScopeStore } from "../src";

describe("ManagementScopeStore", () => {
  function createTestStore(): ManagementScopeStore {
    const resources = new Map<string, ResourceId>();

    return {
      async add(resource) {
        const key = `${resource.type}:${resource.id}`;
        resources.set(key, resource);
      },

      async remove(resource) {
        const key = `${resource.type}:${resource.id}`;
        resources.delete(key);
      },

      async getScope(): Promise<ManagementScope> {
        return {
          resources: [...resources.values()],
        };
      },
    };
  }

  it("starts with an empty management scope", async () => {
    const store = createTestStore();

    await expect(store.getScope()).resolves.toEqual({
      resources: [],
    });
  });

  it("adds a resource to the management scope", async () => {
    const store = createTestStore();

    const resource: ResourceId = {
      type: "worker",
      id: "api",
    };

    await store.add(resource);

    await expect(store.getScope()).resolves.toEqual({
      resources: [resource],
    });
  });

  it("persists resources within the store", async () => {
    const store = createTestStore();

    const resource: ResourceId = {
      type: "worker",
      id: "api",
    };

    await store.add(resource);

    await expect(store.getScope()).resolves.toEqual({
      resources: [resource],
    });
  });

  it("does not create duplicate resources", async () => {
    const store = createTestStore();

    const resource: ResourceId = {
      type: "worker",
      id: "api",
    };

    await store.add(resource);
    await store.add(resource);

    await expect(store.getScope()).resolves.toEqual({
      resources: [resource],
    });
  });

  it("removes a resource from the management scope", async () => {
    const store = createTestStore();

    const resource: ResourceId = {
      type: "worker",
      id: "api",
    };

    await store.add(resource);
    await store.remove(resource);

    await expect(store.getScope()).resolves.toEqual({
      resources: [],
    });
  });

  it("stores multiple resource types", async () => {
    const store = createTestStore();

    const resources: ResourceId[] = [
      {
        type: "worker",
        id: "api",
      },
      {
        type: "dns_record",
        id: "record-1",
      },
      {
        type: "zone",
        id: "example.com",
      },
    ];

    for (const resource of resources) {
      await store.add(resource);
    }

    await expect(store.getScope()).resolves.toEqual({
      resources,
    });
  });

  it("removes only the requested resource", async () => {
    const store = createTestStore();

    const worker: ResourceId = {
      type: "worker",
      id: "api",
    };

    const otherWorker: ResourceId = {
      type: "worker",
      id: "worker-2",
    };

    await store.add(worker);
    await store.add(otherWorker);

    await store.remove(worker);

    await expect(store.getScope()).resolves.toEqual({
      resources: [otherWorker],
    });
  });
});
