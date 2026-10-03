import { DesiredState, Plan } from "@cloudpilot/domain";
import { describe, expect, it, vi } from "vitest";
import { createApp, createFakeExecutionStore } from "./helpers/app";
import { handleRequest } from "../src/app";
import { NoObservationError } from "../src/planning";

describe("apiExecution", () => {
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
});
