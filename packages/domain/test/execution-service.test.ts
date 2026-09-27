import { describe, expect, it, vi } from "vitest";

import {
  createExecutionService,
  type ExecutionResult,
  type OperationExecutor,
  type Plan,
  type PlanOperation,
} from "../src";

function createOperation(id: string): PlanOperation {
  return {
    action: "create",
    resource: {
      id,
      type: "worker",
    },
    dependencies: [],
    desired: {
      resource: {
        id,
        type: "worker",
      },
      attributes: {
        script: 'export default { fetch() { return new Response("ok"); } };',
      },
    },
  };
}

function createPlan(...operations: PlanOperation[]): Plan {
  return {
    operations,
  };
}

describe("ExecutionService", () => {
  it("executes every operation in plan order", async () => {
    const executionOrder: string[] = [];

    const executor: OperationExecutor = {
      execute: vi.fn(async (operation) => {
        executionOrder.push(operation.resource.id);

        return {
          operation,
          status: "succeeded",
        } satisfies ExecutionResult;
      }),
    };

    const service = createExecutionService(executor);

    const plan = createPlan(
      createOperation("first"),
      createOperation("second"),
      createOperation("third"),
    );

    const result = await service.execute(plan);

    expect(executionOrder).toEqual(["first", "second", "third"]);

    expect(result.status).toBe("succeeded");
    expect(result.completed).toBe(3);
    expect(result.failed).toBe(0);
  });

  it("continues independent operations after a failure", async () => {
    const first = createOperation("first");
    const second = createOperation("second");
    const third = createOperation("third");

    const executor: OperationExecutor = {
      execute: vi.fn(async (operation) => {
        if (operation.resource.id === "second") {
          return {
            operation,
            status: "failed",
          } satisfies ExecutionResult;
        }

        return {
          operation,
          status: "succeeded",
        } satisfies ExecutionResult;
      }),
    };

    const service = createExecutionService(executor);

    const result = await service.execute(createPlan(first, second, third));

    expect(executor.execute).toHaveBeenCalledTimes(3);

    expect(result.status).toBe("failed");
    expect(result.completed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("returns every successful execution result", async () => {
    const operations = [createOperation("first"), createOperation("second")];

    const executor: OperationExecutor = {
      execute: vi.fn(
        async (operation) =>
          ({
            operation,
            status: "succeeded",
          }) satisfies ExecutionResult,
      ),
    };

    const service = createExecutionService(executor);

    const result = await service.execute(createPlan(...operations));

    expect(result.results).toEqual([
      {
        operation: operations[0],
        status: "succeeded",
      },
      {
        operation: operations[1],
        status: "succeeded",
      },
    ]);
  });

  it("skips dependent operations when a dependency fails", async () => {
    const dependency = createOperation("dependency");

    const dependent: PlanOperation = {
      ...createOperation("dependent"),
      dependencies: [
        {
          type: "worker",
          id: "dependency",
        },
      ],
    };

    const independent = createOperation("independent");

    const executor: OperationExecutor = {
      execute: vi.fn(async (operation) => {
        if (operation.resource.id === "dependency") {
          return {
            operation,
            status: "failed",
            error: "Deployment failed",
          } satisfies ExecutionResult;
        }

        return {
          operation,
          status: "succeeded",
        } satisfies ExecutionResult;
      }),
    };

    const service = createExecutionService(executor);

    const result = await service.execute(
      createPlan(dependent, independent, dependency),
    );

    expect(executor.execute).toHaveBeenCalledTimes(2);

    expect(result.status).toBe("failed");
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);

    expect(result.results).toEqual([
      {
        operation: dependency,
        status: "failed",
        error: "Deployment failed",
      },
      {
        operation: dependent,
        status: "skipped",
        error: "A dependency failed or was skipped",
      },
      {
        operation: independent,
        status: "succeeded",
      },
    ]);
  });

  it("executes dependencies before dependents", async () => {
    const executionOrder: string[] = [];

    const dependency = createOperation("dependency");

    const dependent: PlanOperation = {
      ...createOperation("dependent"),
      dependencies: [
        {
          type: "worker",
          id: "dependency",
        },
      ],
    };

    const executor: OperationExecutor = {
      execute: vi.fn(async (operation) => {
        executionOrder.push(operation.resource.id);

        return {
          operation,
          status: "succeeded",
        } satisfies ExecutionResult;
      }),
    };

    const service = createExecutionService(executor);

    await service.execute(createPlan(dependent, dependency));

    expect(executionOrder).toEqual(["dependency", "dependent"]);
  });

  it("executes independent operations deterministically", async () => {
    const executionOrder: string[] = [];

    const executor: OperationExecutor = {
      execute: vi.fn(async (operation) => {
        executionOrder.push(operation.resource.id);

        return {
          operation,
          status: "succeeded",
        } satisfies ExecutionResult;
      }),
    };

    const service = createExecutionService(executor);

    await service.execute(
      createPlan(
        createOperation("worker-3"),
        createOperation("worker-1"),
        createOperation("worker-2"),
      ),
    );

    expect(executionOrder).toEqual(["worker-1", "worker-2", "worker-3"]);
  });
});
