import { describe, expect, it, vi } from "vitest";

import type {
  DesiredState,
  ExecutionSummary,
  ObservedState,
  Plan,
  VerificationResult,
} from "@cloudpilot/domain";
import type {
  DesiredStateStore,
  ReconciliationRunStore,
} from "@cloudpilot/state-store";

import { createMemoryReconciliationRunStore } from "@cloudpilot/state-store";

import type { Clock, IdGenerator } from "../src/observation";

import {
  createReconciliationService,
  NoDesiredStateError,
  ReconciliationAlreadyRunningError,
  ReconciliationRunPersistenceError,
} from "../src/reconciliation-service";

describe("ReconciliationService", () => {
  const desired: DesiredState = {
    resources: [
      {
        resource: {
          type: "worker",
          id: "payments-api",
        },
        attributes: {
          compatibilityDate: "2026-08-31",
          script: "worker-script",
        },
      },
    ],
  };

  const changedObservedState: ObservedState = {
    resources: [
      {
        resource: {
          type: "worker",
          id: "payments-api",
        },
        attributes: {
          compatibilityDate: "2026-08-31",
          script: "old-worker-script",
        },
      },
    ],
  };

  const plan: Plan = {
    operations: [
      {
        action: "update",
        resource: {
          type: "worker",
          id: "payments-api",
        },
        desired: desired.resources[0],
        observed: changedObservedState.resources[0],
        dependencies: [],
      },
    ],
  };

  const execution: ExecutionSummary = {
    status: "succeeded",
    results: [
      {
        operation: plan.operations[0],
        status: "succeeded",
      },
    ],
    completed: 1,
    failed: 0,
    skipped: 0,
  };

  function createObservationService(
    state: DesiredState = changedObservedState,
  ) {
    return {
      inspect: vi.fn().mockResolvedValue({
        id: "observation-1",
        startedAt: "2026-10-01T10:00:00.000Z",
        completedAt: "2026-10-01T10:00:01.000Z",
        status: "completed",
        state,
      }),
      getLatest: vi.fn(),
    };
  }

  function createDesiredStateStore(
    state: DesiredState = desired,
  ): DesiredStateStore {
    return {
      saveDesiredState: vi.fn(),
      getDesiredState: vi.fn().mockResolvedValue(state),
    };
  }

  function createEmptyDesiredStateStore(): DesiredStateStore {
    return {
      saveDesiredState: vi.fn(),
      getDesiredState: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createEvaluationService() {
    return {
      evaluate: vi.fn().mockResolvedValue({
        operations: [
          {
            operation: plan.operations[0],
            policy: {
              action: "allow",
              reason: "Operation is permitted",
            },
            risk: {
              level: "low",
              reason: "Low risk operation",
            },
            approval: {
              requirement: "none",
              reason: "No approval required",
            },
            readiness: "ready",
          },
        ],
      }),
    };
  }

  function createExecutionService() {
    return {
      execute: vi.fn().mockResolvedValue(execution),
    };
  }

  function createVerificationService() {
    return {
      verify: vi.fn().mockResolvedValue({
        status: "verified",
        desired,
        observed: desired,
        diff: {
          changes: [],
        },
      } satisfies VerificationResult),
    };
  }

  function createService(overrides?: {
    desiredStateStore?: DesiredStateStore;
    observationService?: ReturnType<typeof createObservationService>;
    evaluationService?: ReturnType<typeof createEvaluationService>;
    executionService?: ReturnType<typeof createExecutionService>;
    verificationService?: ReturnType<typeof createVerificationService>;
    reconciliationRunStore?: ReconciliationRunStore;
    clock?: Clock;
    idGenerator?: IdGenerator;
  }) {
    const desiredStateStore =
      overrides?.desiredStateStore ?? createDesiredStateStore();

    const observationService =
      overrides?.observationService ?? createObservationService();

    const evaluationService =
      overrides?.evaluationService ?? createEvaluationService();

    const executionService =
      overrides?.executionService ?? createExecutionService();

    const verificationService =
      overrides?.verificationService ?? createVerificationService();

    const reconciliationRunStore =
      overrides?.reconciliationRunStore ?? createMemoryReconciliationRunStore();

    const clock = overrides?.clock ?? {
      now: () => new Date("2026-10-09T10:00:00.000Z"),
    };

    const idGenerator = overrides?.idGenerator ?? {
      generate: () => "reconciliation-1",
    };

    const service = createReconciliationService(
      desiredStateStore,
      observationService,
      evaluationService,
      executionService,
      verificationService,
      reconciliationRunStore,
      clock,
      idGenerator,
    );

    return {
      service,
      desiredStateStore,
      observationService,
      evaluationService,
      executionService,
      verificationService,
      reconciliationRunStore,
      clock,
      idGenerator,
    };
  }

  it("returns in_sync when desired state already matches observed state", async () => {
    const observationService = createObservationService(desired);

    const {
      service,
      evaluationService,
      executionService,
      verificationService,
    } = createService({
      observationService,
    });

    const result = await service.reconcile();

    expect(result).toEqual({
      status: "in_sync",
      desired,
    });

    expect(observationService.inspect).toHaveBeenCalledOnce();
    expect(evaluationService.evaluate).not.toHaveBeenCalled();
    expect(executionService.execute).not.toHaveBeenCalled();
    expect(verificationService.verify).not.toHaveBeenCalled();
  });

  it("throws when desired state is not configured", async () => {
    const desiredStateStore = createEmptyDesiredStateStore();

    const { service, observationService } = createService({
      desiredStateStore,
    });

    await expect(service.reconcile()).rejects.toBeInstanceOf(
      NoDesiredStateError,
    );

    expect(desiredStateStore.getDesiredState).toHaveBeenCalledOnce();
    expect(observationService.inspect).not.toHaveBeenCalled();
  });

  it("evaluates, executes, and verifies when drift exists", async () => {
    const {
      service,
      observationService,
      evaluationService,
      executionService,
      verificationService,
    } = createService();

    const result = await service.reconcile();

    expect(result.status).toBe("verified");
    expect(result.desired).toEqual(desired);
    expect(result.plan).toEqual(plan);
    expect(result.execution).toEqual(execution);
    expect(result.verification?.status).toBe("verified");

    expect(observationService.inspect).toHaveBeenCalledOnce();

    expect(evaluationService.evaluate).toHaveBeenCalledOnce();

    expect(executionService.execute).toHaveBeenCalledOnce();
    expect(executionService.execute).toHaveBeenCalledWith(plan);

    expect(verificationService.verify).toHaveBeenCalledOnce();
    expect(verificationService.verify).toHaveBeenCalledWith(desired);
  });

  it("stops when policy blocks an operation", async () => {
    const evaluationService = {
      evaluate: vi.fn().mockResolvedValue({
        operations: [
          {
            operation: plan.operations[0],
            policy: {
              action: "deny",
              reason: "Protected resource",
            },
            risk: {
              level: "high",
              reason: "Protected resource",
            },
            approval: {
              requirement: "none",
              reason: "Policy denied",
            },
            readiness: "blocked",
          },
        ],
      }),
    };

    const { service, executionService, verificationService } = createService({
      evaluationService,
    });

    const result = await service.reconcile();

    expect(result.status).toBe("blocked");
    expect(result.plan).toEqual(plan);

    expect(executionService.execute).not.toHaveBeenCalled();
    expect(verificationService.verify).not.toHaveBeenCalled();
  });

  it("stops when an operation requires approval", async () => {
    const evaluationService = {
      evaluate: vi.fn().mockResolvedValue({
        operations: [
          {
            operation: plan.operations[0],
            policy: {
              action: "allow",
              reason: "Operation is permitted",
            },
            risk: {
              level: "high",
              reason: "High impact operation",
            },
            approval: {
              requirement: "required",
              reason: "Human approval required",
            },
            readiness: "approval_required",
          },
        ],
      }),
    };

    const { service, executionService, verificationService } = createService({
      evaluationService,
    });

    const result = await service.reconcile();

    expect(result.status).toBe("approval_required");
    expect(result.plan).toEqual(plan);

    expect(executionService.execute).not.toHaveBeenCalled();
    expect(verificationService.verify).not.toHaveBeenCalled();
  });

  it("returns mismatch when execution completes but verification detects drift", async () => {
    const verificationService = {
      verify: vi.fn().mockResolvedValue({
        status: "mismatch",
        desired,
        observed: changedObservedState,
        diff: {
          changes: [
            {
              type: "update",
              desired: desired.resources[0],
              observed: changedObservedState.resources[0],
            },
          ],
        },
      } satisfies VerificationResult),
    };

    const { service, executionService, reconciliationRunStore } = createService(
      {
        verificationService,
      },
    );

    const result = await service.reconcile();

    expect(result.status).toBe("mismatch");
    expect(result.execution).toEqual(execution);
    expect(result.verification?.status).toBe("mismatch");

    expect(executionService.execute).toHaveBeenCalledOnce();
    expect(verificationService.verify).toHaveBeenCalledOnce();

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "completed",
      result: {
        status: "mismatch",
      },
    });
  });

  it("returns failed when verification fails", async () => {
    const verificationService = {
      verify: vi.fn().mockResolvedValue({
        status: "failed",
        desired,
        error: "Inventory unavailable",
      } satisfies VerificationResult),
    };

    const { service, reconciliationRunStore } = createService({
      verificationService,
    });

    const result = await service.reconcile();

    expect(result.status).toBe("failed");
    expect(result.verification?.status).toBe("failed");
    expect(result.verification).toEqual({
      status: "failed",
      desired,
      error: "Inventory unavailable",
    });

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "completed",
      result: {
        status: "failed",
      },
    });
  });

  it("claims the run before inspection and persists its terminal record", async () => {
    const { service, observationService, reconciliationRunStore } =
      createService();

    const startRun = vi.spyOn(reconciliationRunStore, "startRun");
    const saveRun = vi.spyOn(reconciliationRunStore, "saveRun");

    const result = await service.reconcile();

    expect(result.status).toBe("verified");
    expect(startRun).toHaveBeenCalledOnce();
    expect(startRun).toHaveBeenCalledWith({
      id: "reconciliation-1",
      startedAt: "2026-10-09T10:00:00.000Z",
      status: "running",
    });

    expect(startRun.mock.invocationCallOrder[0]).toBeLessThan(
      observationService.inspect.mock.invocationCallOrder[0],
    );

    expect(saveRun).toHaveBeenCalledOnce();
    expect(saveRun).toHaveBeenCalledWith({
      id: "reconciliation-1",
      startedAt: "2026-10-09T10:00:00.000Z",
      completedAt: "2026-10-09T10:00:00.000Z",
      status: "completed",
      result,
    });

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      id: "reconciliation-1",
      status: "completed",
      result: {
        status: "verified",
      },
    });
  });

  it("persists blocked outcomes as completed reconciliation runs", async () => {
    const evaluationService = {
      evaluate: vi.fn().mockResolvedValue({
        operations: [
          {
            operation: plan.operations[0],
            policy: {
              action: "deny",
              reason: "Protected resource",
            },
            risk: {
              level: "high",
              reason: "Protected resource",
            },
            approval: {
              requirement: "none",
              reason: "Policy denied",
            },
            readiness: "blocked",
          },
        ],
      }),
    };

    const { service, reconciliationRunStore } = createService({
      evaluationService,
    });

    const result = await service.reconcile();

    expect(result.status).toBe("blocked");

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "completed",
      result: {
        status: "blocked",
      },
    });
  });

  it("persists missing desired state as a failed run and rethrows the error", async () => {
    const desiredStateStore = createEmptyDesiredStateStore();

    const { service, reconciliationRunStore } = createService({
      desiredStateStore,
    });

    await expect(service.reconcile()).rejects.toBeInstanceOf(
      NoDesiredStateError,
    );

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "failed",
      result: {
        status: "failed",
        error: "No desired state configured",
      },
    });
  });

  it("persists verification failure as a failed reconciliation run", async () => {
    const verificationService = {
      verify: vi.fn().mockResolvedValue({
        status: "failed",
        desired,
        error: "Inventory unavailable",
      } satisfies VerificationResult),
    };

    const { service, reconciliationRunStore } = createService({
      verificationService,
    });

    const result = await service.reconcile();

    expect(result.status).toBe("failed");

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "completed",
      result: {
        status: "failed",
      },
    });
  });

  it("persists unexpected workflow exceptions and rethrows them", async () => {
    const failure = new Error("Inventory unavailable");

    const observationService = {
      inspect: vi.fn().mockRejectedValue(failure),
      getLatest: vi.fn(),
    };

    const { service, reconciliationRunStore } = createService({
      observationService,
    });

    await expect(service.reconcile()).rejects.toBe(failure);

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "failed",
      result: {
        status: "failed",
        error: "Inventory unavailable",
      },
    });
  });

  it("does not return a result when terminal persistence fails", async () => {
    const { service, reconciliationRunStore } = createService();

    const persistenceError = new Error("D1 unavailable");

    const saveRun = vi
      .spyOn(reconciliationRunStore, "saveRun")
      .mockRejectedValue(persistenceError);

    await expect(service.reconcile()).rejects.toMatchObject({
      name: "ReconciliationRunPersistenceError",
      message:
        "Reconciliation produced a result, but its terminal record could not be persisted; the run may remain marked as running.",
      persistenceError,
    });

    expect(saveRun).toHaveBeenCalledOnce();

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "running",
    });
  });

  it("preserves the workflow error when persisting failure also fails", async () => {
    const workflowError = new Error("Inventory unavailable");
    const persistenceError = new Error("D1 unavailable");

    const observationService = {
      inspect: vi.fn().mockRejectedValue(workflowError),
      getLatest: vi.fn(),
    };

    const { service, reconciliationRunStore } = createService({
      observationService,
    });

    const saveRun = vi
      .spyOn(reconciliationRunStore, "saveRun")
      .mockRejectedValue(persistenceError);

    await expect(service.reconcile()).rejects.toMatchObject({
      name: "ReconciliationRunPersistenceError",
      persistenceError,
      workflowError,
    });

    expect(saveRun).toHaveBeenCalledOnce();

    await expect(
      reconciliationRunStore.getRun("reconciliation-1"),
    ).resolves.toMatchObject({
      status: "running",
    });
  });

  it("does not inspect infrastructure if claiming the run fails", async () => {
    const observationService = createObservationService();

    const failure = new Error("Reconciliation storage unavailable");

    const reconciliationRunStore: ReconciliationRunStore = {
      startRun: vi.fn().mockRejectedValue(failure),
      saveRun: vi.fn(),
      getRun: vi.fn().mockResolvedValue(undefined),
      getLatestRun: vi.fn().mockResolvedValue(undefined),
    };

    const {
      service,
      evaluationService,
      executionService,
      verificationService,
    } = createService({
      observationService,
      reconciliationRunStore,
    });

    await expect(service.reconcile()).rejects.toBe(failure);

    expect(reconciliationRunStore.startRun).toHaveBeenCalledOnce();
    expect(reconciliationRunStore.saveRun).not.toHaveBeenCalled();

    expect(observationService.inspect).not.toHaveBeenCalled();
    expect(evaluationService.evaluate).not.toHaveBeenCalled();
    expect(executionService.execute).not.toHaveBeenCalled();
    expect(verificationService.verify).not.toHaveBeenCalled();
  });

  it("rejects a concurrent run without performing reconciliation work", async () => {
    const observationService = createObservationService();

    const reconciliationRunStore: ReconciliationRunStore = {
      startRun: vi.fn().mockResolvedValue(false),
      saveRun: vi.fn(),
      getRun: vi.fn().mockResolvedValue(undefined),
      getLatestRun: vi.fn().mockResolvedValue(undefined),
    };

    const {
      service,
      evaluationService,
      executionService,
      verificationService,
    } = createService({
      observationService,
      reconciliationRunStore,
    });

    await expect(service.reconcile()).rejects.toBeInstanceOf(
      ReconciliationAlreadyRunningError,
    );

    await expect(service.reconcile()).rejects.toMatchObject({
      message: "A reconciliation is already running",
    });

    expect(reconciliationRunStore.startRun).toHaveBeenCalledTimes(2);
    expect(reconciliationRunStore.saveRun).not.toHaveBeenCalled();

    expect(observationService.inspect).not.toHaveBeenCalled();
    expect(evaluationService.evaluate).not.toHaveBeenCalled();
    expect(executionService.execute).not.toHaveBeenCalled();
    expect(verificationService.verify).not.toHaveBeenCalled();
  });
});
