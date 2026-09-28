import { describe, expect, it, vi } from "vitest";

import type { OperationExecutor, Plan } from "@cloudpilot/domain";

import { createExecutionService } from "../src/execution";

describe("ExecutionService", () => {
  it("executes a plan through the operation executor", async () => {
    const plan: Plan = {
      operations: [
        {
          action: "create",
          resource: {
            type: "worker",
            id: "payments-api",
          },
          dependencies: [],
        },
      ],
    };

    const operation = {
      action: "create" as const,
      resource: {
        type: "worker" as const,
        id: "payments-api",
      },
      dependencies: [],
    };

    const execute = vi.fn().mockResolvedValue({
      operation: plan.operations[0],
      status: "succeeded",
    });

    const operationExecutor: OperationExecutor = {
      execute,
    };

    const service = createExecutionService(operationExecutor);

    const report = await service.execute(plan);

    expect(report).toEqual({
      status: "succeeded",
      results: [
        {
          operation,
          status: "succeeded",
        },
      ],
      completed: 1,
      failed: 0,
      skipped: 0,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(plan.operations[0]);
  });

  it("preserves dependency execution ordering", async () => {
    const dependency = {
      action: "create" as const,
      resource: {
        type: "worker" as const,
        id: "worker-1",
      },
      dependencies: [],
    };

    const dependent = {
      action: "create" as const,
      resource: {
        type: "worker" as const,
        id: "worker-2",
      },
      dependencies: [
        {
          type: "worker" as const,
          id: "worker-1",
        },
      ],
    };

    const executed: string[] = [];

    const operationExecutor: OperationExecutor = {
      async execute(operation) {
        executed.push(operation.resource.id);

        return {
          operation,
          status: "succeeded",
        };
      },
    };

    const service = createExecutionService(operationExecutor);

    await service.execute({
      operations: [dependent, dependency],
    });

    expect(executed).toEqual(["worker-1", "worker-2"]);
  });

  it("converts operation executor failures into failed results", async () => {
    const operation = {
      action: "create" as const,
      resource: {
        type: "worker" as const,
        id: "payments-api",
      },
      dependencies: [],
    };

    const operationExecutor: OperationExecutor = {
      execute: vi.fn().mockRejectedValue(new Error("Cloudflare failed")),
    };

    const service = createExecutionService(operationExecutor);

    const report = await service.execute({
      operations: [operation],
    });

    expect(report).toEqual({
      status: "failed",
      results: [
        {
          operation,
          status: "failed",
          error: "Cloudflare failed",
        },
      ],
      completed: 0,
      failed: 1,
      skipped: 0,
    });
  });
});
