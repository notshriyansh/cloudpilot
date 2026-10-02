import { describe, expect, it, vi } from "vitest";
import type { ExecutionStore, Observation } from "@cloudpilot/state-store";
import { handleRequest, type App } from "../src/app";
import type {
  DesiredState,
  ExecutionRecord,
  Plan,
  PlanEvaluator,
} from "@cloudpilot/domain";
import { NoObservationError } from "../src/planning";
import type { EvaluationService } from "../src/evaluation";
import { createReconciliationService } from "../src/reconciliation-service";

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

function createFakePlanEvaluator(): PlanEvaluator {
  return {
    evaluate: vi.fn().mockReturnValue({
      operations: [],
    }),
  };
}

function createFakeEvaluationService(): EvaluationService {
  return {
    evaluate: vi.fn().mockResolvedValue({
      operations: [],
    }),
  };
}

function createApp(overrides: Partial<App> = {}): App {
  return {
    observationService: {
      inspect: vi.fn(),
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

    executionStore: createFakeExecutionStore(),

    planEvaluator: createFakePlanEvaluator(),

    evaluationService: createFakeEvaluationService(),

    verificationService: {
      verify: vi.fn(),
    },

    reconciliationService: {
      reconcile: vi.fn(),
    },

    ...overrides,
  };
}

describe("handleRequest", () => {
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

    const app = createApp({
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      executionStore,
    });

    const request = new Request("https://example.com/");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
    expect(inspect).not.toHaveBeenCalled();
  });

  it("returns 404 for unsupported methods on /inspect", async () => {
    const inspect = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect,
        getLatest: vi.fn(),
      },
      executionStore,
    });

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
    const inspect = vi.fn().mockResolvedValue(observation);

    const app = createApp({
      observationService: {
        inspect,
        getLatest,
      },
      executionStore,
    });

    const request = new Request("https://example.com/state");

    const response = await handleRequest(request, app);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(observation);
    expect(getLatest).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when no observation exists", async () => {
    const getLatest = vi.fn().mockResolvedValue(undefined);
    const executionStore = createFakeExecutionStore();
    const inspect = vi.fn();

    const app = createApp({
      observationService: {
        inspect,
        getLatest,
      },
      executionStore,
    });

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

    const inspect = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect,
        getLatest,
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionStore,
    });

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

    const verify = vi.fn().mockResolvedValue({
      status: "verified" as const,
      changes: [],
    });

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

    const execute = vi.fn().mockResolvedValue({
      status: "succeeded" as const,
      results: [
        {
          operation: plan.operations[0],
          status: "succeeded" as const,
        },
      ],
      completed: 1,
      failed: 0,
      skipped: 0,
    });

    const evaluate = vi.fn().mockResolvedValue({
      operations: [
        {
          operation: plan.operations[0],
          policy: {
            action: "allow",
            reason: "Operation is permitted",
          },
          risk: {
            level: "low",
            reason: "Low risk operation",
          },
          approval: {
            requirement: "none",
            reason: "No approval required",
          },
          readiness: "ready",
        },
      ],
    });

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionService: {
        execute,
      },
      evaluationService: {
        evaluate,
      },
      verificationService: {
        verify,
      },
      executionStore,
    });

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
      status: string;
      results: unknown[];
    };

    expect(body).toEqual({
      executionId: expect.any(String),
      status: "succeeded",
      results: [
        {
          operation: plan.operations[0],
          status: "succeeded",
        },
      ],
      completed: 1,
      failed: 0,
      skipped: 0,
      verification: {
        status: "verified",
        changes: [],
      },
    });

    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledWith(desired);

    expect(planning).toHaveBeenCalledOnce();
    expect(planning).toHaveBeenCalledWith(desired);

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(plan);

    expect(verify).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledWith(desired);
  });

  it("returns 500 when post-execution verification fails", async () => {
    const plan: Plan = {
      operations: [],
    };

    const planning = vi.fn().mockResolvedValue(plan);

    const execute = vi.fn().mockResolvedValue({
      status: "succeeded" as const,
      results: [],
      completed: 0,
      failed: 0,
      skipped: 0,
    });

    const evaluate = vi.fn().mockResolvedValue({
      operations: [],
    });

    const verify = vi.fn().mockRejectedValue(new Error("verification failed"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      planningService: {
        plan: planning,
      },
      executionService: {
        execute,
      },
      evaluationService: {
        evaluate,
      },
      verificationService: {
        verify,
      },
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/execute", {
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

    expect(execute).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledOnce();
  });

  it("returns 400 for invalid JSON on POST /execute", async () => {
    const planning = vi.fn();
    const execute = vi.fn();
    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionService: {
        execute,
      },
      executionStore,
    });

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

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },
      planningService: {
        plan: planning,
      },
      executionService: {
        execute,
      },
      executionStore,
    });

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

    const evaluate = vi.fn().mockRejectedValue(new NoObservationError());

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },

      evaluationService: {
        evaluate,
      },

      executionService: {
        execute,
      },

      executionStore,
    });

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
    expect(evaluate).toHaveBeenCalledOnce();
  });

  it("returns 500 when execution fails", async () => {
    const plan: Plan = {
      operations: [],
    };

    const planning = vi.fn().mockResolvedValue(plan);

    const execute = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const evaluate = vi.fn().mockResolvedValue({
      operations: [],
    });

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      observationService: {
        inspect: vi.fn(),
        getLatest: vi.fn(),
      },

      planningService: {
        plan: planning,
      },

      executionService: {
        execute,
      },

      evaluationService: {
        evaluate,
      },

      executionStore,
    });

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

  it("evaluates a desired state through the evaluation service", async () => {
    const evaluate = vi.fn().mockResolvedValue({
      operations: [
        {
          operation: {
            action: "create",
            resource: {
              type: "worker",
              id: "payments-api",
            },
            dependencies: [],
          },
          policy: {
            action: "allow",
            reason: "Operation is permitted by the default policy",
          },
          risk: {
            level: "low",
            reason: "Low risk operation",
          },
          approval: {
            requirement: "none",
            reason: "Operation does not require human approval",
          },
          readiness: "ready",
        },
      ],
    });

    const app = createApp({
      evaluationService: {
        evaluate,
      },
    });

    const desired: DesiredState = {
      resources: [
        {
          resource: {
            type: "worker",
            id: "payments-api",
          },
          attributes: {},
        },
      ],
    };

    const response = await handleRequest(
      new Request("http://localhost/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desired),
      }),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      operations: [
        {
          operation: {
            action: "create",
            resource: {
              type: "worker",
              id: "payments-api",
            },
            dependencies: [],
          },
          policy: {
            action: "allow",
            reason: "Operation is permitted by the default policy",
          },
          risk: {
            level: "low",
            reason: "Low risk operation",
          },
          approval: {
            requirement: "none",
            reason: "Operation does not require human approval",
          },
          readiness: "ready",
        },
      ],
    });

    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledWith(desired);
  });

  it("returns 400 for invalid JSON on /evaluate", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("http://localhost/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{invalid",
      }),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON",
    });
  });

  it("returns 400 for an invalid desired state on /evaluate", async () => {
    const evaluate = vi.fn();

    const app = createApp({
      evaluationService: {
        evaluate,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/evaluate", {
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

    expect(await response.json()).toEqual({
      error: "Invalid desired state",
      errors: [
        {
          path: "resources",
          message: "resources must be an array",
        },
      ],
    });

    expect(evaluate).not.toHaveBeenCalled();
  });

  it("does not execute when evaluation blocks an operation", async () => {
    const evaluate = vi.fn().mockResolvedValue({
      operations: [
        {
          operation: {
            action: "delete",
            resource: {
              type: "zone",
              id: "production",
            },
            dependencies: [],
          },
          policy: {
            action: "deny",
            reason: "Deleting zones is not permitted by the default policy",
          },
          risk: {
            level: "critical",
            reason: "Deleting a zone can have a broad infrastructure impact",
          },
          approval: {
            requirement: "none",
            reason: "Denied operations cannot proceed to approval",
          },
          readiness: "blocked",
        },
      ],
    });

    const plan = vi.fn();
    const execute = vi.fn();

    const app = createApp({
      evaluationService: {
        evaluate,
      },
      planningService: {
        plan,
      },
      executionService: {
        execute,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/execute", {
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

    expect(response.status).toBe(403);

    expect(await response.json()).toEqual({
      error: "Execution blocked by policy",
      operations: [
        expect.objectContaining({
          readiness: "blocked",
        }),
      ],
    });

    expect(evaluate).toHaveBeenCalledOnce();
    expect(plan).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not execute when evaluation requires approval", async () => {
    const evaluate = vi.fn().mockResolvedValue({
      operations: [
        {
          operation: {
            action: "delete",
            resource: {
              type: "dns_record",
              id: "production-api",
            },
            dependencies: [],
          },
          policy: {
            action: "allow",
            reason: "Operation is permitted",
          },
          risk: {
            level: "high",
            reason: "Deleting a DNS record can affect traffic routing",
          },
          approval: {
            requirement: "required",
            reason: "high risk operations require human approval",
          },
          readiness: "approval_required",
        },
      ],
    });

    const plan = vi.fn();
    const execute = vi.fn();

    const app = createApp({
      evaluationService: {
        evaluate,
      },
      planningService: {
        plan,
      },
      executionService: {
        execute,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/execute", {
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

    expect(response.status).toBe(409);

    expect(await response.json()).toEqual({
      error: "Execution requires human approval",
      operations: [
        expect.objectContaining({
          readiness: "approval_required",
        }),
      ],
    });

    expect(evaluate).toHaveBeenCalledOnce();
    expect(plan).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns an execution by ID", async () => {
    const execution: ExecutionRecord = {
      id: "execution-1",
      startedAt: "2026-09-29T10:00:00.000Z",
      completedAt: "2026-09-29T10:00:05.000Z",
      status: "succeeded",
      summary: {
        status: "succeeded",
        results: [],
        completed: 0,
        failed: 0,
        skipped: 0,
      },
    };

    const executionStore = createFakeExecutionStore();
    await executionStore.saveExecution(execution);

    const app = createApp({
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/execution-1"),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(execution);

    expect(await executionStore.getExecution("execution-1")).toEqual(execution);
  });

  it("returns 404 when an execution does not exist", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("http://localhost/executions/missing-execution"),
      app,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "Execution not found",
    });
  });

  it("returns the latest execution", async () => {
    const firstExecution: ExecutionRecord = {
      id: "execution-1",
      startedAt: "2026-09-29T10:00:00.000Z",
      completedAt: "2026-09-29T10:00:05.000Z",
      status: "succeeded",
      summary: {
        status: "succeeded",
        results: [],
        completed: 0,
        failed: 0,
        skipped: 0,
      },
    };

    const latestExecution: ExecutionRecord = {
      id: "execution-2",
      startedAt: "2026-09-29T11:00:00.000Z",
      completedAt: "2026-09-29T11:00:05.000Z",
      status: "failed",
      summary: {
        status: "failed",
        results: [],
        completed: 0,
        failed: 1,
        skipped: 0,
      },
    };

    const executionStore = createFakeExecutionStore();

    await executionStore.saveExecution(firstExecution);
    await executionStore.saveExecution(latestExecution);

    const app = createApp({
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/latest"),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(latestExecution);
  });

  it("returns 404 when no latest execution exists", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("http://localhost/executions/latest"),
      app,
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toEqual({
      error: "No execution available",
    });
  });

  it("returns 500 when execution retrieval fails", async () => {
    const getExecution = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      executionStore: {
        ...executionStore,
        getExecution,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/execution-1"),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Execution retrieval failed",
    });

    expect(getExecution).toHaveBeenCalledOnce();
    expect(getExecution).toHaveBeenCalledWith("execution-1");
  });

  it("returns 500 when latest execution retrieval fails", async () => {
    const getLatestExecution = vi
      .fn()
      .mockRejectedValue(new Error("sensitive internal failure"));

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      executionStore: {
        ...executionStore,
        getLatestExecution,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/latest"),
      app,
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Latest execution retrieval failed",
    });

    expect(getLatestExecution).toHaveBeenCalledOnce();
  });

  it("returns 400 for an invalid execution path", async () => {
    const getExecution = vi.fn();

    const executionStore = createFakeExecutionStore();

    const app = createApp({
      executionStore: {
        ...executionStore,
        getExecution,
      },
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/"),
      app,
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid execution path",
    });

    expect(getExecution).not.toHaveBeenCalled();
  });

  it("returns an in-progress execution without completedAt or summary", async () => {
    const execution: ExecutionRecord = {
      id: "execution-running",
      startedAt: "2026-09-29T12:00:00.000Z",
      status: "running",
    };

    const executionStore = createFakeExecutionStore();
    await executionStore.saveExecution(execution);

    const app = createApp({
      executionStore,
    });

    const response = await handleRequest(
      new Request("http://localhost/executions/execution-running"),
      app,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(execution);
  });

  it("returns 200 when POST /reconcile finds desired state already in sync", async () => {
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

    const reconcile = vi.fn().mockResolvedValue({
      status: "in_sync",
      desired,
    });

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desired),
      }),
      app,
    );

    expect(response.status).toBe(200);

    expect(await response.json()).toEqual({
      status: "in_sync",
      desired,
    });

    expect(reconcile).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledWith(desired);
  });

  it("returns 403 when POST /reconcile is blocked by policy", async () => {
    const desired: DesiredState = {
      resources: [],
    };

    const reconcile = vi.fn().mockResolvedValue({
      status: "blocked",
      desired,
      plan: {
        operations: [],
      },
    });

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desired),
      }),
      app,
    );

    expect(response.status).toBe(403);
  });

  it("returns 409 when POST /reconcile requires approval", async () => {
    const desired: DesiredState = {
      resources: [],
    };

    const reconcile = vi.fn().mockResolvedValue({
      status: "approval_required",
      desired,
      plan: {
        operations: [],
      },
    });

    const app = createApp({
      reconciliationService: {
        reconcile,
      },
    });

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(desired),
      }),
      app,
    );

    expect(response.status).toBe(409);
  });

  it("returns 400 for invalid JSON on POST /reconcile", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{invalid",
      }),
      app,
    );

    expect(response.status).toBe(400);

    expect(await response.json()).toEqual({
      error: "Invalid JSON",
    });
  });

  it("returns 400 for invalid desired state on POST /reconcile", async () => {
    const app = createApp();

    const response = await handleRequest(
      new Request("https://example.com/reconcile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          invalid: true,
        }),
      }),
      app,
    );

    expect(response.status).toBe(400);

    expect(await response.json()).toMatchObject({
      error: "Invalid desired state",
    });
  });
});
