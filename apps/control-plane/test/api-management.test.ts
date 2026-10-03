import { describe, expect, it, vi } from "vitest";
import { createApp, createFakeExecutionStore } from "./helpers/app";
import { handleRequest } from "../src/app";

describe("apiManagement", () => {
  it("returns the current management scope", async () => {
    const scope = {
      resources: [
        {
          type: "worker" as const,
          id: "fluxion-api",
        },
      ],
    };

    const managementService = {
      register: vi.fn(),
      unregister: vi.fn(),
      getScope: vi.fn().mockResolvedValue(scope),
    };

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService,
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources"),
      app,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(scope);
    expect(managementService.getScope).toHaveBeenCalledOnce();
  });

  it("returns 500 when management scope retrieval fails", async () => {
    const managementService = {
      register: vi.fn(),
      unregister: vi.fn(),
      getScope: vi
        .fn()
        .mockRejectedValue(new Error("sensitive internal failure")),
    };

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService,
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources"),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Management scope retrieval failed",
    });
  });

  it("registers a managed resource", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const executionStore = createFakeExecutionStore();
    const managementService = {
      register,
      unregister: vi.fn(),
      getScope: vi.fn(),
    };

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService,
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "worker",
          id: "fluxion-api",
        }),
      }),
      app,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      resource: {
        type: "worker",
        id: "fluxion-api",
      },
    });

    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith({
      type: "worker",
      id: "fluxion-api",
    });
  });

  it("returns 400 for an invalid managed resource", async () => {
    const executionStore = createFakeExecutionStore();
    const register = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const managementService = {
      register,
      unregister: vi.fn(),
      getScope: vi.fn(),
    };

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService,
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "r2_bucket",
          id: "bucket",
        }),
      }),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid managed resource",
      errors: [
        {
          path: "type",
          message: "type is not a supported resource type",
        },
      ],
    });

    expect(register).not.toHaveBeenCalled();
  });

  it("returns 500 when managed resource registration fails", async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService: {
        register,
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "worker",
          id: "fluxion-api",
        }),
      }),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Management resource registration failed",
    });
  });

  it("unregisters a managed resource", async () => {
    const unregister = vi.fn().mockResolvedValue(undefined);
    const executionStore = createFakeExecutionStore();
    const managementService = {
      register: vi.fn(),
      unregister,
      getScope: vi.fn(),
    };

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService,
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources/worker/fluxion-api", {
        method: "DELETE",
      }),
      app,
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(unregister).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledWith({
      type: "worker",
      id: "fluxion-api",
    });
  });

  it("returns 400 for an invalid managed resource path", async () => {
    const executionStore = createFakeExecutionStore();
    const unregister = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const managementService = {
      register: vi.fn(),
      unregister,
      getScope: vi.fn(),
    };

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService,
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources/r2_bucket/bucket", {
        method: "DELETE",
      }),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid managed resource",
      errors: [
        {
          path: "resource",
          message: "type is not a supported resource type",
        },
      ],
    });

    expect(unregister).not.toHaveBeenCalled();
  });

  it("returns 500 when managed resource unregistration fails", async () => {
    const unregister = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister,
        getScope: vi.fn(),
      },
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/managed-resources/worker/fluxion-api", {
        method: "DELETE",
      }),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Management resource unregistration failed",
    });
  });
});
