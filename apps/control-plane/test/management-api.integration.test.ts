import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";

import { createD1ManagementScopeStore } from "@cloudpilot/state-store";

import { createManagementService } from "../src/management";

describe("management API persistence", () => {
  beforeEach(async () => {
    await env.cloudpilot.prepare("DELETE FROM managed_resources").run();
  });

  it("persists a registered resource in D1", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);
    const service = createManagementService(store);

    await service.register({
      type: "worker",
      id: "fluxion-api",
    });

    const scope = await service.getScope();

    expect(scope).toEqual({
      resources: [
        {
          type: "worker",
          id: "fluxion-api",
        },
      ],
    });
  });

  it("does not duplicate an already managed resource", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);
    const service = createManagementService(store);

    const resource = {
      type: "worker" as const,
      id: "fluxion-api",
    };

    await service.register(resource);
    await service.register(resource);

    const scope = await service.getScope();

    expect(scope).toEqual({
      resources: [resource],
    });
  });

  it("persists management state across service instances", async () => {
    const firstStore = createD1ManagementScopeStore(env.cloudpilot);
    const firstService = createManagementService(firstStore);

    await firstService.register({
      type: "worker",
      id: "global-link-api",
    });

    const secondStore = createD1ManagementScopeStore(env.cloudpilot);
    const secondService = createManagementService(secondStore);

    await expect(secondService.getScope()).resolves.toEqual({
      resources: [
        {
          type: "worker",
          id: "global-link-api",
        },
      ],
    });
  });

  it("registers and unregisters a resource", async () => {
    const store = createD1ManagementScopeStore(env.cloudpilot);
    const service = createManagementService(store);

    const resource = {
      type: "worker" as const,
      id: "fluxion-api",
    };

    await service.register(resource);

    await expect(service.getScope()).resolves.toEqual({
      resources: [resource],
    });

    await service.unregister(resource);

    await expect(service.getScope()).resolves.toEqual({
      resources: [],
    });
  });
});
