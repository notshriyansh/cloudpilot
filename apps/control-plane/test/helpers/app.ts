import { ExecutionRecord, PlanEvaluator } from "@cloudpilot/domain";
import { ExecutionStore } from "@cloudpilot/state-store";
import { vi } from "vitest";
import { EvaluationService } from "../../src/evaluation";
import { App } from "../../src/app";

export function createFakeExecutionStore(): ExecutionStore {
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

export const desiredState = {
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

export function createFakePlanEvaluator(): PlanEvaluator {
  return {
    evaluate: vi.fn().mockReturnValue({
      operations: [],
    }),
  };
}

export function createFakeEvaluationService(): EvaluationService {
  return {
    evaluate: vi.fn().mockResolvedValue({
      operations: [],
    }),
  };
}

export function createApp(overrides: Partial<App> = {}): App {
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
