import { describe, expect, it, vi } from "vitest";

import type { PlanOperation, ResourceState } from "@cloudpilot/domain";

import {
  createWorkerOperationExecutor,
  type WorkerOperationExecutor,
} from "../src/worker-operation";

function createWorkerState(
  overrides: Partial<ResourceState["attributes"]> = {},
): ResourceState {
  return {
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
      ...overrides,
    },
  };
}

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

describe("WorkerOperationExecutor", () => {
  it("deploys a Worker for a create operation", async () => {
    const provider = createProvider();
    const executor: WorkerOperationExecutor =
      createWorkerOperationExecutor(provider);

    const desired = createWorkerState();

    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      desired,
      dependencies: [],
    };

    await executor.execute(operation);

    expect(provider.deployWorker).toHaveBeenCalledOnce();
    expect(provider.deployWorker).toHaveBeenCalledWith("payments-api", {
      script: desired.attributes.script,
      compatibilityDate: "2026-08-31",
    });

    expect(provider.deleteWorker).not.toHaveBeenCalled();
  });

  it("deploys a Worker for an update operation", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const desired = createWorkerState({
      script: `
export default {
  async fetch() {
    return new Response("updated");
  }
};
`,
    });

    const operation: PlanOperation = {
      action: "update",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      desired,
      observed: {
        resource: {
          type: "worker",
          id: "payments-api",
        },
        attributes: {
          script: `
export default {
  async fetch() {
    return new Response("old");
  }
};
`,
        },
      },
      dependencies: [],
    };

    await executor.execute(operation);

    expect(provider.deployWorker).toHaveBeenCalledOnce();
    expect(provider.deployWorker).toHaveBeenCalledWith("payments-api", {
      script: desired.attributes.script,
      compatibilityDate: "2026-08-31",
    });

    expect(provider.deleteWorker).not.toHaveBeenCalled();
  });

  it("deletes a Worker for a delete operation", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      observed: createWorkerState(),
      dependencies: [],
    };

    await executor.execute(operation);

    expect(provider.deleteWorker).toHaveBeenCalledOnce();
    expect(provider.deleteWorker).toHaveBeenCalledWith("payments-api");

    expect(provider.deployWorker).not.toHaveBeenCalled();
  });

  it("does not require desired state for a delete operation", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      dependencies: [],
    };

    await expect(executor.execute(operation)).resolves.toEqual({
      operation,
      status: "succeeded",
    });

    expect(provider.deleteWorker).toHaveBeenCalledWith("payments-api");
  });

  it("rejects a create operation without desired state", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      dependencies: [],
    };

    await expect(executor.execute(operation)).rejects.toThrow(
      'Worker create operation requires desired state for "payments-api"',
    );

    expect(provider.deployWorker).not.toHaveBeenCalled();
  });

  it("rejects an update operation without desired state", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "update",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      dependencies: [],
    };

    await expect(executor.execute(operation)).rejects.toThrow(
      'Worker update operation requires desired state for "payments-api"',
    );

    expect(provider.deployWorker).not.toHaveBeenCalled();
  });

  it("rejects a Worker with a missing script", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      desired: {
        resource: {
          type: "worker",
          id: "payments-api",
        },
        attributes: {
          compatibilityDate: "2026-08-31",
        },
      },
      dependencies: [],
    };

    await expect(executor.execute(operation)).rejects.toThrow(
      "Worker desired state requires a non-empty script",
    );

    expect(provider.deployWorker).not.toHaveBeenCalled();
  });

  it("rejects a Worker with an empty script", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      desired: createWorkerState({
        script: "   ",
      }),
      dependencies: [],
    };

    await expect(executor.execute(operation)).rejects.toThrow(
      "Worker desired state requires a non-empty script",
    );

    expect(provider.deployWorker).not.toHaveBeenCalled();
  });

  it("allows a Worker without compatibility metadata", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

    const desired = createWorkerState();
    delete desired.attributes.compatibilityDate;

    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      desired,
      dependencies: [],
    };

    await executor.execute(operation);

    expect(provider.deployWorker).toHaveBeenCalledWith("payments-api", {
      script: desired.attributes.script,
    });
  });

  it("propagates provider deployment errors", async () => {
    const provider = createProvider();

    const error = new Error("Cloudflare deployment failed");

    provider.deployWorker.mockRejectedValueOnce(error);

    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "create",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      desired: createWorkerState(),
      dependencies: [],
    };

    await expect(executor.execute(operation)).rejects.toBe(error);
  });

  it("propagates provider deletion errors", async () => {
    const provider = createProvider();

    const error = new Error("Cloudflare deletion failed");

    provider.deleteWorker.mockRejectedValueOnce(error);

    const executor = createWorkerOperationExecutor(provider);

    const operation: PlanOperation = {
      action: "delete",
      resource: {
        type: "worker",
        id: "payments-api",
      },
      dependencies: [],
    };

    await expect(executor.execute(operation)).rejects.toBe(error);
  });

  it("rejects non-Worker resources", async () => {
    const provider = createProvider();
    const executor = createWorkerOperationExecutor(provider);

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
      'Worker executor cannot execute resource type "dns_record"',
    );

    expect(provider.deployWorker).not.toHaveBeenCalled();
    expect(provider.deleteWorker).not.toHaveBeenCalled();
  });
});
