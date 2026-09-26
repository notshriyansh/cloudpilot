import type {
  ExecutionResult,
  PlanOperation,
  ResourceState,
} from "@cloudpilot/domain";

import type { CloudflareProvider } from "./provider";
import type { CloudflareWorkerDeployment } from "./worker";

export interface WorkerOperationExecutor {
  execute(operation: PlanOperation): Promise<ExecutionResult>;
}

export function createWorkerOperationExecutor(
  provider: CloudflareProvider,
): WorkerOperationExecutor {
  return {
    async execute(operation: PlanOperation): Promise<ExecutionResult> {
      if (operation.resource.type !== "worker") {
        throw new Error(
          `Worker executor cannot execute resource type "${operation.resource.type}"`,
        );
      }

      switch (operation.action) {
        case "create":
          await executeCreate(provider, operation);
          return {
            operation,
            status: "succeeded",
          };

        case "update":
          await executeUpdate(provider, operation);
          return {
            operation,
            status: "succeeded",
          };

        case "delete":
          await executeDelete(provider, operation);
          return {
            operation,
            status: "succeeded",
          };
      }
    },
  };
}

async function executeCreate(
  provider: CloudflareProvider,
  operation: PlanOperation,
): Promise<void> {
  const desired = requireDesiredState(operation, "create");

  const deployment = workerDeploymentFromState(desired);

  await provider.deployWorker(operation.resource.id, deployment);
}

async function executeUpdate(
  provider: CloudflareProvider,
  operation: PlanOperation,
): Promise<void> {
  const desired = requireDesiredState(operation, "update");

  const deployment = workerDeploymentFromState(desired);

  await provider.deployWorker(operation.resource.id, deployment);
}

async function executeDelete(
  provider: CloudflareProvider,
  operation: PlanOperation,
): Promise<void> {
  await provider.deleteWorker(operation.resource.id);
}

function requireDesiredState(
  operation: PlanOperation,
  action: "create" | "update",
): ResourceState {
  if (operation.desired === undefined) {
    throw new Error(
      `Worker ${action} operation requires desired state for "${operation.resource.id}"`,
    );
  }

  return operation.desired;
}

function workerDeploymentFromState(
  state: ResourceState,
): CloudflareWorkerDeployment {
  const attributes = state.attributes;

  if (
    !("script" in attributes) ||
    typeof attributes.script !== "string" ||
    attributes.script.trim().length === 0
  ) {
    throw new Error("Worker desired state requires a non-empty script");
  }

  const compatibilityDate =
    "compatibilityDate" in attributes &&
    typeof attributes.compatibilityDate === "string"
      ? attributes.compatibilityDate
      : undefined;

  return {
    script: attributes.script,
    ...(compatibilityDate !== undefined ? { compatibilityDate } : {}),
  };
}
