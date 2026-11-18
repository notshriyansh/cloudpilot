import type {
  ExecutionCapability,
  ExecutionResult,
  ExecutionSupport,
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

export const createCloudflareExecutionCapability =
  (): ExecutionCapability =>
  (operation): ExecutionSupport => {
    switch (operation.resource.type) {
      case "worker":
        return { supported: true };

      case "zone":
        return {
          supported: false,
          reason:
            "Zone operations are not supported by the Cloudflare executor.",
        };

      case "dns_record":
        return {
          supported: false,
          reason:
            "DNS record operations are not supported by the Cloudflare executor.",
        };
    }

    return {
      supported: false,
      reason: "This resource type is not supported by the Cloudflare executor.",
    };
  };
