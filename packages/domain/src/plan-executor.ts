import type {
  ExecutionReport,
  ExecutionResult,
  OperationExecutor,
  PlanExecutor,
} from "./execution";
import {
  OperationGraphCycleError,
  buildOperationGraph,
  topologicalOrderOperations,
} from "./graph";
import type { Plan, PlanOperation } from "./plan";
import { resourceIdKey } from "./state";

export class PlanExecutionCycleError extends Error {
  constructor() {
    super("Plan contains a dependency cycle and cannot be executed");
    this.name = "PlanExecutionCycleError";
  }
}

export function createPlanExecutor(
  operationExecutor: OperationExecutor,
): PlanExecutor {
  return {
    async execute(plan: Plan): Promise<ExecutionReport> {
      let orderedResources;

      try {
        const graph = buildOperationGraph(plan.operations);
        orderedResources = topologicalOrderOperations(graph);
      } catch (error) {
        if (error instanceof OperationGraphCycleError) {
          throw new PlanExecutionCycleError();
        }

        throw error;
      }

      const operationsByKey = new Map(
        plan.operations.map((operation) => [
          resourceIdKey(operation.resource),
          operation,
        ]),
      );

      const resultsByKey = new Map<string, ExecutionResult>();

      for (const resource of orderedResources) {
        const key = resourceIdKey(resource);
        const operation = operationsByKey.get(key);

        if (!operation) {
          continue;
        }

        const dependencyFailed = operation.dependencies.some((dependency) => {
          const dependencyResult = resultsByKey.get(resourceIdKey(dependency));

          return (
            dependencyResult?.status === "failed" ||
            dependencyResult?.status === "skipped"
          );
        });

        if (dependencyFailed) {
          resultsByKey.set(key, {
            operation,
            status: "skipped",
            error: "A dependency failed or was skipped",
          });

          continue;
        }

        const result = await operationExecutor.execute(operation);

        resultsByKey.set(key, result);
      }

      return {
        results: orderedResources
          .map((resource) => resultsByKey.get(resourceIdKey(resource)))
          .filter((result): result is ExecutionResult => result !== undefined),
      };
    },
  };
}
