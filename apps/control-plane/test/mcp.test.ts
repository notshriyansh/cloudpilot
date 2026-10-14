import { describe, expect, it, vi } from "vitest";
import { createApp } from "./helpers/app";
import { updateDisposableWorker } from "../src/mcp";

const workerId = "cloudpilot-disposable-test";

const input = {
  script: 'export default { fetch() { return new Response("ok"); } };',
  compatibilityDate: "2026-08-31",
};

function createReadyEvaluation() {
  return {
    operations: [
      {
        operation: {
          action: "update" as const,
          resource: { type: "worker" as const, id: workerId },
          desired: {
            resource: { type: "worker" as const, id: workerId },
            attributes: {
              script: input.script,
              compatibilityDate: input.compatibilityDate,
            },
          },
          dependencies: [],
        },
        policy: { action: "allow" as const, reason: "Permitted" },
        risk: { level: "low" as const, reason: "Low risk" },
        approval: { requirement: "none" as const, reason: "Not required" },
        readiness: "ready" as const,
      },
    ],
  };
}

function createTestApp() {
  return createApp({
    managementService: {
      register: vi.fn(),
      unregister: vi.fn(),
      getScope: vi.fn().mockResolvedValue({
        resources: [{ type: "worker", id: workerId }],
      }),
    },
    evaluationService: {
      evaluate: vi.fn().mockResolvedValue(createReadyEvaluation()),
    },
    executionService: {
      execute: vi.fn().mockResolvedValue({
        status: "succeeded",
        results: [],
        completed: 1,
        failed: 0,
        skipped: 0,
      }),
    },
    verificationService: {
      verify: vi.fn().mockResolvedValue({ status: "verified" }),
    },
    observationService: {
      inspect: vi.fn().mockResolvedValue({
        id: "test-observation",
        startedAt: "2026-10-14T00:00:00.000Z",
        completedAt: "2026-10-14T00:00:01.000Z",
        status: "completed",
        state: {
          resources: [
            {
              resource: { type: "worker", id: workerId },
              attributes: {
                script: input.script,
                compatibilityDate: input.compatibilityDate,
              },
            },
          ],
        },
      }),
      getLatest: vi.fn(),
    },
  });
}

describe("updateDisposableWorker", () => {
  it("fails closed when the allowlist is missing", async () => {
    const app = createTestApp();

    const result = await updateDisposableWorker(app, undefined, input);

    expect(result.isError).toBe(true);
    expect(app.managementService.getScope).not.toHaveBeenCalled();
    expect(app.executionService.execute).not.toHaveBeenCalled();
  });

  it("rejects a Worker not registered in management scope", async () => {
    const app = createTestApp();
    vi.mocked(app.managementService.getScope).mockResolvedValue({
      resources: [],
    });

    const result = await updateDisposableWorker(app, workerId, input);

    expect(result.isError).toBe(true);
    expect(app.evaluationService.evaluate).not.toHaveBeenCalled();
    expect(app.executionService.execute).not.toHaveBeenCalled();
  });

  it("does not execute a policy-denied operation", async () => {
    const app = createTestApp();
    vi.mocked(app.evaluationService.evaluate).mockResolvedValue({
      operations: createReadyEvaluation().operations.map((entry) => ({
        ...entry,
        policy: { action: "deny", reason: "Denied" },
        readiness: "blocked",
      })),
    });

    const result = await updateDisposableWorker(app, workerId, input);

    expect(result.isError).toBe(true);
    expect(app.executionService.execute).not.toHaveBeenCalled();
  });

  it("does not execute an operation requiring approval", async () => {
    const app = createTestApp();
    vi.mocked(app.evaluationService.evaluate).mockResolvedValue({
      operations: createReadyEvaluation().operations.map((entry) => ({
        ...entry,
        approval: { requirement: "required", reason: "Review required" },
        readiness: "approval_required",
      })),
    });

    const result = await updateDisposableWorker(app, workerId, input);

    expect(result.isError).toBe(true);
    expect(app.executionService.execute).not.toHaveBeenCalled();
  });

  it("rejects an evaluated operation targeting another Worker", async () => {
    const app = createTestApp();
    vi.mocked(app.evaluationService.evaluate).mockResolvedValue({
      operations: createReadyEvaluation().operations.map((entry) => ({
        ...entry,
        operation: {
          ...entry.operation,
          resource: { type: "worker", id: "production-worker" },
        },
      })),
    });

    const result = await updateDisposableWorker(app, workerId, input);

    expect(result.isError).toBe(true);
    expect(app.executionService.execute).not.toHaveBeenCalled();
  });

  it("executes an allowed update and verifies the desired state", async () => {
    const app = createTestApp();

    const result = await updateDisposableWorker(app, workerId, input);

    expect(result.isError).toBeUndefined();
    expect(app.executionService.execute).toHaveBeenCalledOnce();
    expect(app.verificationService.verify).toHaveBeenCalledOnce();
  });

  it("does not verify or report success when execution fails", async () => {
    const app = createTestApp();

    vi.mocked(app.executionService.execute).mockResolvedValue({
      status: "failed",
      results: [],
      completed: 0,
      failed: 1,
      skipped: 0,
    });

    const result = await updateDisposableWorker(app, workerId, input);

    expect(result.isError).toBe(true);
    expect(app.verificationService.verify).not.toHaveBeenCalled();
    expect(app.executionStore.getLatestExecution).toBeDefined();
  });

  it("reports an error when verification does not confirm the desired state", async () => {
    const app = createTestApp();

    vi.mocked(app.verificationService.verify).mockResolvedValue({
      status: "mismatch",
      desired: {
        resources: [],
      },
      observed: {
        resources: [],
      },
      diff: {
        changes: [],
      },
    });

    const result = await updateDisposableWorker(app, workerId, input);

    expect(result.isError).toBe(true);
    expect(app.executionService.execute).toHaveBeenCalledOnce();
  });
});
