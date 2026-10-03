import { describe, expect, it, vi } from "vitest";
import { type ExecutionStore } from "@cloudpilot/state-store";
import { handleRequest, type App } from "../src/app";
import type { ExecutionRecord, PlanEvaluator } from "@cloudpilot/domain";
import type { EvaluationService } from "../src/evaluation";

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

const desiredState = {
  resources: [
    {
      resource: {
        type: "zone",
        id: "example.com",
      },
      attributes: {
        name: "example.com",
      },
    },
    {
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      attributes: {
        name: "api.example.com",
        type: "A",
        content: "203.0.113.10",
      },
    },
  ],
};

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

    desiredStateStore: {
      saveDesiredState: vi.fn(),
      getDesiredState: vi.fn(),
    },

    ...overrides,
  };
}

describe("handleRequest", () => {
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
});
