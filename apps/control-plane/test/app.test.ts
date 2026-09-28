import { describe, expect, it, vi } from "vitest";
import type { ExecutionStore, Observation } from "@cloudpilot/state-store";
import { handleRequest, type App } from "../src/app";
import type { DesiredState, ExecutionRecord, Plan } from "@cloudpilot/domain";
import { NoObservationError } from "../src/planning";

describe("handleRequest", () => {
  function createFakeExecutionStore(): ExecutionStore {
    const executions = new Map<string, ExecutionRecord>();

    return {
      async saveExecution(execution) {
        executions.set(execution.id, execution);
      },

      async getExecution(id) {
        return executions.get(id);
      },

      async getLatestExecution() {
        return [...executions.values()].at(-1);
      },
    };
  }

  it("returns an observation for GET /inspect", async () => {
    const observation: Observation = {
      id: "observation-1",
      startedAt: "2026-09-07T10:00:00.000Z",
      completedAt: "2026-09-07T10:00:05.000Z",
      status: "completed",
      state: {
        resources: [],
      },
    };

    const inspect = vi.fn().mockResolvedValue(observation);
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/inspect");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(observation);
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for unknown routes", async () => {
    const inspect = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(inspect).not.toHaveBeenCalled();
  });

  it("returns 404 for unsupported methods on /inspect", async () => {
    const inspect = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/inspect", {
      method: "POST",
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(inspect).not.toHaveBeenCalled();
  });

  it("returns 500 when inspection fails", async () => {
    const inspect = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/inspect");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: "Inspection failed",
    });
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it("returns the latest observation for GET /state", async () => {
    const observation: Observation = {
      id: "observation-1",
      startedAt: "2026-09-07T10:00:00.000Z",
      completedAt: "2026-09-07T10:00:05.000Z",
      status: "completed",
      state: {
        resources: [],
      },
    };

    const getLatest = vi.fn().mockResolvedValue(observation);
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest,
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(observation);
    expect(getLatest).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when no observation exists", async () => {
    const getLatest = vi.fn().mockResolvedValue(undefined);
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest,
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No observation available",
    });
  });

  it("returns 500 when state retrieval fails", async () => {
    const getLatest = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest,
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "State retrieval failed",
    });
  });

  it("returns a plan for POST /plan", async () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "payments-api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
          },
        },
      ],
    };

    const plan: Plan = {
      operations: [
        {
          action: "create",
          resource: {
            type: "worker",
            id: "payments-api",
          },
          desired: desired.resources[0],
          dependencies: [],
        },
      ],
    };

    const planning = vi.fn().mockResolvedValue(plan);
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(desired),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(plan);
    expect(planning).toHaveBeenCalledTimes(1);
    expect(planning).toHaveBeenCalledWith(desired);
  });

  it("returns 400 for invalid JSON on POST /plan", async () => {
    const planning = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{invalid json",
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid JSON",
    });
    expect(planning).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid desired state", async () => {
    const planning = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resources: "not-an-array",
      }),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid desired state",
      errors: [
        {
          path: "resources",
          message: "resources must be an array",
        },
      ],
    });
    expect(planning).not.toHaveBeenCalled();
  });

  it("returns 404 when planning has no observation", async () => {
    const planning = vi.fn().mockRejectedValue(new NoObservationError());
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resources: [],
      }),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No observation available",
    });
  });

  it("returns 500 when planning fails", async () => {
    const planning = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

    const request = new Request("https://example.com/plan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        resources: [],
      }),
    });

    const response = await handleRequest(request, app);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Planning failed",
    });
  });

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService,
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService,
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register,
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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
    const register = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register,
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register,
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister,
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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
    const unregister = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister,
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: vi.fn(),
      },
      managementService: {
        register: vi.fn(),
        unregister,
        getScope: vi.fn(),
      },
      executionService: {
        execute: vi.fn(),
      },
      executionStore,
    };

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

  it("plans and executes desired state for POST /execute", async () => {
    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "payments-api",
          },
          attributes: {
            compatibilityDate: "2026-08-31",
            script: `
export default {
  async fetch() {
    return new Response("ok");
  }
};
`,
          },
        },
      ],
    };

    const plan: Plan = {
      operations: [
        {
          action: "create",
          resource: {
            type: "worker",
            id: "payments-api",
          },
          desired: desired.resources[0],
          dependencies: [],
        },
      ],
    };

    const report = {
      results: [
        {
          operation: plan.operations[0],
          status: "succeeded" as const,
        },
      ],
    };

    const planning = vi.fn().mockResolvedValue(plan);
    const execute = vi.fn().mockResolvedValue(report);
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute,
      },
      executionStore,
    };

    const response = await handleRequest(
      new Request("https://example.com/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desired),
      }),
      app,
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      executionId: string;
      results: typeof report.results;
    };

    expect(body).toEqual({
      ...report,
      executionId: expect.any(String),
    });

    expect(body.executionId).toEqual(expect.any(String));

    expect(planning).toHaveBeenCalledOnce();
    expect(planning).toHaveBeenCalledWith(desired);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(plan);
  });

  it("returns 400 for invalid JSON on POST /execute", async () => {
    const planning = vi.fn();
    const execute = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute,
      },
      executionStore,
    };

    const response = await handleRequest(
      new Request("https://example.com/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{invalid json",
      }),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON",
    });

    expect(planning).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid desired state on POST /execute", async () => {
    const planning = vi.fn();
    const execute = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute,
      },
      executionStore,
    };

    const response = await handleRequest(
      new Request("https://example.com/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resources: "not-an-array",
        }),
      }),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid desired state",
      errors: [
        {
          path: "resources",
          message: "resources must be an array",
        },
      ],
    });

    expect(planning).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 404 when executing without an observation", async () => {
    const planning = vi.fn().mockRejectedValue(new NoObservationError());
    const execute = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute,
      },
      executionStore,
    };

    const response = await handleRequest(
      new Request("https://example.com/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resources: [],
        }),
      }),
      app,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "No observation available",
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 500 when execution fails", async () => {
    const plan: Plan = {
      operations: [],
    };

    const planning = vi.fn().mockResolvedValue(plan);

    const execute = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app: App = {
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      managementService: {
        register: vi.fn(),
        unregister: vi.fn(),
        getScope: vi.fn(),
      },
      executionService: {
        execute,
      },
      executionStore,
    };

    const response = await handleRequest(
      new Request("https://example.com/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resources: [],
        }),
      }),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Execution failed",
    });
  });
});
