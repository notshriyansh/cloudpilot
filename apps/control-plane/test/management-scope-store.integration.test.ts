import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import type { ResourceId } from "@cloudpilot/domain";
import { createD1ManagementScopeStore } from "@cloudpilot/state-store";

describe("D1ManagementScopeStore", () => {
  beforeEach(async () => {
    await env.cloudpilot.prepare("DELETE FROM managed_resources").run();
  });

  it("starts with an empty management scope", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);

    await expect(store.getScope()).resolves.toEqual({
      resources: [],
    });
  });

  it("adds a resource to the management scope", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);

    const resource: ResourceId = {
      type: "worker",
      id: "api",
    };

    await store.add(resource);

    await expect(store.getScope()).resolves.toEqual({
      resources: [resource],
    });
  });

  it("persists resources across store instances", async () => {
    const firstStore = createD1ManagementScopeStore(env.cloudpilot);
    const secondStore = createD1ManagementScopeStore(env.cloudpilot);

    const resource: ResourceId = {
      type: "worker",
      id: "api",
    };

    await firstStore.add(resource);

    await expect(secondStore.getScope()).resolves.toEqual({
      resources: [resource],
    });
  });

  it("does not create duplicate ownership records", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);

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
    const store = createD1ManagementScopeStore(env.cloudpilot);

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

  it("removes only the requested resource", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);

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

  it("stores multiple resource types", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);

    const resources: ResourceId[] = [
      {
        type: "dns_record",
        id: "record-1",
      },
      {
        type: "worker",
        id: "api",
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
});
