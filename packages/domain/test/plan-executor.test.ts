import { describe, expect, it, vi } from "vitest";

import {
  PlanExecutionCycleError,
  createPlanExecutor,
  type ExecutionResult,
  type OperationExecutor,
  type Plan,
  type PlanOperation,
} from "../src";

function worker(id: string): PlanOperation {
  return {
    action: "create",
    resource: {
      type: "worker",
      id,
    },
    dependencies: [],
  };
}

function workerWithDependencies(
  id: string,
  dependencies: string[],
): PlanOperation {
  return {
    action: "create",
    resource: {
      type: "worker",
      id,
    },
    dependencies: dependencies.map((dependency) => ({
      type: "worker",
      id: dependency,
    })),
  };
}

function createSuccessfulExecutor(
  executed: PlanOperation[],
): OperationExecutor {
  return {
    async execute(operation) {
      executed.push(operation);

      return {
        operation,
        status: "succeeded",
      };
    },
  };
}

describe("createPlanExecutor", () => {
  it("executes an empty plan", async () => {
    const executed: PlanOperation[] = [];

    const executor = createPlanExecutor(createSuccessfulExecutor(executed));

    const report = await executor.execute({
      operations: [],
    });

    expect(report).toEqual({
      results: [],
    });

    expect(executed).toEqual([]);
  });

  it("executes a single operation", async () => {
    const executed: PlanOperation[] = [];
    const operation = worker("worker-1");

    const executor = createPlanExecutor(createSuccessfulExecutor(executed));

    const report = await executor.execute({
      operations: [operation],
    });

    expect(executed).toEqual([operation]);

    expect(report.results).toEqual([
      {
        operation,
        status: "succeeded",
      },
    ]);
  });

  it("executes dependencies before dependent operations", async () => {
    const executed: PlanOperation[] = [];

    const dependency = worker("worker-1");

    const dependent = workerWithDependencies("worker-2", ["worker-1"]);

    const executor = createPlanExecutor(createSuccessfulExecutor(executed));

    await executor.execute({
      operations: [dependent, dependency],
    });

    expect(executed).toEqual([dependency, dependent]);
  });

  it("executes delete operations before their dependencies", async () => {
    const executed: PlanOperation[] = [];

    const dependency: PlanOperation = {
      action: "delete",
      resource: {
        type: "zone",
        id: "zone-1",
      },
      dependencies: [],
    };

    const dependent: PlanOperation = {
      action: "delete",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      dependencies: [
        {
          type: "zone",
          id: "zone-1",
        },
      ],
    };

    const executor = createPlanExecutor(createSuccessfulExecutor(executed));

    await executor.execute({
      operations: [dependency, dependent],
    });

    expect(executed).toEqual([dependent, dependency]);
  });

  it("executes independent operations", async () => {
    const executed: PlanOperation[] = [];

    const first = worker("worker-1");
    const second = worker("worker-2");

    const executor = createPlanExecutor(createSuccessfulExecutor(executed));

    await executor.execute({
      operations: [first, second],
    });

    expect(executed).toHaveLength(2);
    expect(executed).toContain(first);
    expect(executed).toContain(second);
  });

  it("does not execute a dependent operation after a dependency fails", async () => {
    const dependency = worker("worker-1");
    const dependent = workerWithDependencies("worker-2", ["worker-1"]);

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockImplementation(async (operation) => {
        if (operation.resource.id === "worker-1") {
          return {
            operation,
            status: "failed",
            error: "Provider request failed",
          };
        }

        return {
          operation,
          status: "succeeded",
        };
      });

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [dependent, dependency],
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(dependency);

    expect(report.results).toEqual([
      {
        operation: dependency,
        status: "failed",
        error: "Provider request failed",
      },
      {
        operation: dependent,
        status: "skipped",
        error: "A dependency failed or was skipped",
      },
    ]);
  });

  it("converts operation executor errors into failed results", async () => {
    const failedOperation = worker("worker-1");
    const dependentOperation = workerWithDependencies("worker-2", ["worker-1"]);
    const independentOperation = worker("worker-3");

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockImplementation(async (operation) => {
        if (operation.resource.id === "worker-1") {
          throw new Error("Cloudflare deployment failed");
        }

        return {
          operation,
          status: "succeeded",
        };
      });

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [dependentOperation, independentOperation, failedOperation],
    });

    expect(execute).toHaveBeenCalledTimes(2);

    expect(report.results).toContainEqual({
      operation: failedOperation,
      status: "failed",
      error: "Cloudflare deployment failed",
    });

    expect(report.results).toContainEqual({
      operation: dependentOperation,
      status: "skipped",
      error: "A dependency failed or was skipped",
    });

    expect(report.results).toContainEqual({
      operation: independentOperation,
      status: "succeeded",
    });
  });

  it("converts operation executor errors into failed execution results", async () => {
    const operation = worker("worker-1");

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockRejectedValue(new Error("Provider request failed"));

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [operation],
    });

    expect(execute).toHaveBeenCalledOnce();

    expect(report.results).toEqual([
      {
        operation,
        status: "failed",
        error: "Provider request failed",
      },
    ]);
  });

  it("continues independent operations after an executor throws", async () => {
    const failedOperation = worker("worker-1");
    const independentOperation = worker("worker-2");

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockImplementation(async (operation) => {
        if (operation.resource.id === "worker-1") {
          throw new Error("Provider request failed");
        }

        return {
          operation,
          status: "succeeded",
        };
      });

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [failedOperation, independentOperation],
    });

    expect(execute).toHaveBeenCalledTimes(2);

    expect(report.results).toEqual([
      {
        operation: failedOperation,
        status: "failed",
        error: "Provider request failed",
      },
      {
        operation: independentOperation,
        status: "succeeded",
      },
    ]);
  });

  it("skips dependents after an executor throws", async () => {
    const dependency = worker("worker-1");
    const dependent = workerWithDependencies("worker-2", ["worker-1"]);

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockImplementation(async (operation) => {
        if (operation.resource.id === "worker-1") {
          throw new Error("Provider request failed");
        }

        return {
          operation,
          status: "succeeded",
        };
      });

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [dependent, dependency],
    });

    expect(execute).toHaveBeenCalledTimes(1);

    expect(report.results).toEqual([
      {
        operation: dependency,
        status: "failed",
        error: "Provider request failed",
      },
      {
        operation: dependent,
        status: "skipped",
        error: "A dependency failed or was skipped",
      },
    ]);
  });

  it("stringifies non-Error executor failures", async () => {
    const operation = worker("worker-1");

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockRejectedValue("Provider request failed");

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [operation],
    });

    expect(report.results).toEqual([
      {
        operation,
        status: "failed",
        error: "Provider request failed",
      },
    ]);
  });

  it("continues executing independent operations after another operation fails", async () => {
    const failedOperation = worker("worker-1");
    const independentOperation = worker("worker-2");

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockImplementation(async (operation) => {
        if (operation.resource.id === "worker-1") {
          return {
            operation,
            status: "failed",
            error: "Provider request failed",
          };
        }

        return {
          operation,
          status: "succeeded",
        };
      });

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [failedOperation, independentOperation],
    });

    expect(execute).toHaveBeenCalledTimes(2);

    expect(report.results).toContainEqual({
      operation: failedOperation,
      status: "failed",
      error: "Provider request failed",
    });

    expect(report.results).toContainEqual({
      operation: independentOperation,
      status: "succeeded",
    });
  });

  it("skips an operation when its dependency was skipped", async () => {
    const skippedDependency = worker("worker-1");

    const dependent = workerWithDependencies("worker-2", ["worker-1"]);

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockImplementation(async (operation) => {
        if (operation.resource.id === "worker-1") {
          return {
            operation,
            status: "skipped",
            error: "Operation intentionally skipped",
          };
        }

        return {
          operation,
          status: "succeeded",
        };
      });

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [dependent, skippedDependency],
    });

    expect(execute).toHaveBeenCalledTimes(1);

    expect(report.results).toEqual([
      {
        operation: skippedDependency,
        status: "skipped",
        error: "Operation intentionally skipped",
      },
      {
        operation: dependent,
        status: "skipped",
        error: "A dependency failed or was skipped",
      },
    ]);
  });

  it("preserves the operation executor result", async () => {
    const operation = worker("worker-1");

    const customResult: ExecutionResult = {
      operation,
      status: "failed",
      error: "Custom execution failure",
    };

    const executor = createPlanExecutor({
      async execute() {
        return customResult;
      },
    });

    const report = await executor.execute({
      operations: [operation],
    });

    expect(report.results).toEqual([customResult]);
  });

  it("produces deterministic execution order", async () => {
    const executed: PlanOperation[] = [];

    const worker3 = worker("worker-3");
    const worker1 = worker("worker-1");
    const worker2 = worker("worker-2");

    const executor = createPlanExecutor(createSuccessfulExecutor(executed));

    await executor.execute({
      operations: [worker3, worker1, worker2],
    });

    expect(executed.map((operation) => operation.resource.id)).toEqual([
      "worker-1",
      "worker-2",
      "worker-3",
    ]);
  });

  it("skips transitive dependents after a dependency failure", async () => {
    const root = worker("worker-1");

    const middle = workerWithDependencies("worker-2", ["worker-1"]);

    const leaf = workerWithDependencies("worker-3", ["worker-2"]);

    const execute = vi
      .fn<OperationExecutor["execute"]>()
      .mockImplementation(async (operation) => {
        if (operation.resource.id === "worker-1") {
          return {
            operation,
            status: "failed",
            error: "Root operation failed",
          };
        }

        return {
          operation,
          status: "succeeded",
        };
      });

    const executor = createPlanExecutor({
      execute,
    });

    const report = await executor.execute({
      operations: [leaf, middle, root],
    });

    expect(execute).toHaveBeenCalledTimes(1);

    expect(report.results).toEqual([
      {
        operation: root,
        status: "failed",
        error: "Root operation failed",
      },
      {
        operation: middle,
        status: "skipped",
        error: "A dependency failed or was skipped",
      },
      {
        operation: leaf,
        status: "skipped",
        error: "A dependency failed or was skipped",
      },
    ]);
  });

  it("rejects plans containing dependency cycles", async () => {
    const first = workerWithDependencies("worker-1", ["worker-2"]);

    const second = workerWithDependencies("worker-2", ["worker-1"]);

    const execute = vi.fn<OperationExecutor["execute"]>();

    const executor = createPlanExecutor({
      execute,
    });

    await expect(
      executor.execute({
        operations: [first, second],
      }),
    ).rejects.toBeInstanceOf(PlanExecutionCycleError);

    expect(execute).not.toHaveBeenCalled();
  });
});
