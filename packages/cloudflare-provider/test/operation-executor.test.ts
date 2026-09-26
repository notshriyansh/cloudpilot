import { describe, expect, it, vi } from "vitest";

import type { PlanOperation } from "@cloudpilot/domain";

import { createCloudflareOperationExecutor } from "../src/operation-executor";

function createProvider() {
  return {
    getAccount: vi.fn(),
    listZones: vi.fn(),
    listDnsRecords: vi.fn(),
    listWorkers: vi.fn(),
    deployWorker: vi.fn().mockResolvedValue(undefined),
    deleteWorker: vi.fn().mockResolvedValue(undefined),
  };
}

function workerOperation(action: PlanOperation["action"]): PlanOperation {
  return {
    action,
    resource: {
      type: "worker",
      id: "payments-api",
    },
    ...(action !== "delete"
      ? {
          desired: {
            resource: {
              type: "worker",
              id: "payments-api",
            },
            attributes: {
              script: `
export default {
  async fetch() {
    return new Response("ok");
  }
};
`,
              compatibilityDate: "2026-08-31",
            },
          },
        }
      : {}),
    dependencies: [],
  };
}

describe("CloudflareOperationExecutor", () => {
  it("dispatches Worker create operations", async () => {
    const provider = createProvider();

    const executor = createCloudflareOperationExecutor(provider);

    const operation = workerOperation("create");

    const result = await executor.execute(operation);

    expect(result).toEqual({
      operation,
      status: "succeeded",
    });

    expect(provider.deployWorker).toHaveBeenCalledOnce();
    expect(provider.deleteWorker).not.toHaveBeenCalled();
  });

  it("dispatches Worker update operations", async () => {
    const provider = createProvider();

    const executor = createCloudflareOperationExecutor(provider);

    const operation = workerOperation("update");

    const result = await executor.execute(operation);

    expect(result).toEqual({
      operation,
      status: "succeeded",
    });

    expect(provider.deployWorker).toHaveBeenCalledOnce();
    expect(provider.deleteWorker).not.toHaveBeenCalled();
  });

  it("dispatches Worker delete operations", async () => {
    const provider = createProvider();

    const executor = createCloudflareOperationExecutor(provider);

    const operation = workerOperation("delete");

    const result = await executor.execute(operation);

    expect(result).toEqual({
      operation,
      status: "succeeded",
    });

    expect(provider.deleteWorker).toHaveBeenCalledOnce();
    expect(provider.deployWorker).not.toHaveBeenCalled();
  });

  it("propagates Worker executor failures", async () => {
    const provider = createProvider();

    const error = new Error("Cloudflare deployment failed");

    provider.deployWorker.mockRejectedValueOnce(error);

    const executor = createCloudflareOperationExecutor(provider);

    const operation = workerOperation("create");

    await expect(executor.execute(operation)).rejects.toBe(error);
  });

  it("rejects unsupported resource types", async () => {
    const provider = createProvider();

    const executor = createCloudflareOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "dns_record",
        id: "record-1",
      },
      desired: {
        resource: {
          type: "dns_record",
          id: "record-1",
        },
        attributes: {},
      },
      dependencies: [],
    };

    await expect(executor.execute(operation)).rejects.toThrow(
      'No operation executor is registered for resource type "dns_record"',
    );

    expect(provider.deployWorker).not.toHaveBeenCalled();
    expect(provider.deleteWorker).not.toHaveBeenCalled();
  });
});
