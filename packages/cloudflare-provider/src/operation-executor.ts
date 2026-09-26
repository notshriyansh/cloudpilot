import type {
  ExecutionResult,
  OperationExecutor,
  PlanOperation,
} from "@cloudpilot/domain";

import type { CloudflareProvider } from "./provider";
import {
  createWorkerOperationExecutor,
  type WorkerOperationExecutor,
} from "./worker-operation";

export interface CloudflareOperationExecutor extends OperationExecutor {}

export function createCloudflareOperationExecutor(
  provider: CloudflareProvider,
): CloudflareOperationExecutor {
  const workerExecutor: WorkerOperationExecutor =
    createWorkerOperationExecutor(provider);

  return {
    async execute(operation: PlanOperation): Promise<ExecutionResult> {
      switch (operation.resource.type) {
        case "worker":
          return workerExecutor.execute(operation);

        default:
          throw new Error(
            `No operation executor is registered for resource type "${operation.resource.type}"`,
          );
      }
    },
  };
}
