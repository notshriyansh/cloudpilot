import { describe, expect, it, vi } from "vitest";

import type {
  DesiredState,
  ExecutionSummary,
  Plan,
  VerificationResult,
} from "@cloudpilot/domain";

import { createReconciliationService } from "../src/reconciliation-service";

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

  const changedObservedState: DesiredState = {
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

  function createPlanningService() {
    return {
      plan: vi.fn().mockResolvedValue(plan),
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
    observationService?: ReturnType<typeof createObservationService>;
    planningService?: ReturnType<typeof createPlanningService>;
    evaluationService?: ReturnType<typeof createEvaluationService>;
    executionService?: ReturnType<typeof createExecutionService>;
    verificationService?: ReturnType<typeof createVerificationService>;
  }) {
    const observationService =
      overrides?.observationService ?? createObservationService();

    const planningService =
      overrides?.planningService ?? createPlanningService();

    const evaluationService =
      overrides?.evaluationService ?? createEvaluationService();

    const executionService =
      overrides?.executionService ?? createExecutionService();

    const verificationService =
      overrides?.verificationService ?? createVerificationService();

    const service = createReconciliationService(
      observationService,
      planningService,
      evaluationService,
      executionService,
      verificationService,
    );

    return {
      service,
      observationService,
      planningService,
      evaluationService,
      executionService,
      verificationService,
    };
  }

  it("returns in_sync when desired state already matches observed state", async () => {
    const observationService = createObservationService(desired);

    const {
      service,
      planningService,
      evaluationService,
      executionService,
      verificationService,
    } = createService({
      observationService,
    });

    const result = await service.reconcile(desired);

    expect(result).toEqual({
      status: "in_sync",
      desired,
    });

    expect(observationService.inspect).toHaveBeenCalledOnce();
    expect(planningService.plan).not.toHaveBeenCalled();
    expect(evaluationService.evaluate).not.toHaveBeenCalled();
    expect(executionService.execute).not.toHaveBeenCalled();
    expect(verificationService.verify).not.toHaveBeenCalled();
  });

  it("plans, evaluates, executes, and verifies when drift exists", async () => {
    const {
      service,
      observationService,
      planningService,
      evaluationService,
      executionService,
      verificationService,
    } = createService();

    const result = await service.reconcile(desired);

    expect(result.status).toBe("verified");
    expect(result.desired).toEqual(desired);
    expect(result.plan).toEqual(plan);
    expect(result.execution).toEqual(execution);
    expect(result.verification?.status).toBe("verified");

    expect(observationService.inspect).toHaveBeenCalledOnce();

    expect(planningService.plan).toHaveBeenCalledOnce();
    expect(planningService.plan).toHaveBeenCalledWith(desired);

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

    const { service, planningService, executionService, verificationService } =
      createService({
        evaluationService,
      });

    const result = await service.reconcile(desired);

    expect(result.status).toBe("blocked");
    expect(result.plan).toEqual(plan);

    expect(planningService.plan).toHaveBeenCalledOnce();
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

    const result = await service.reconcile(desired);

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

    const { service, executionService } = createService({
      verificationService,
    });

    const result = await service.reconcile(desired);

    expect(result.status).toBe("mismatch");
    expect(result.execution).toEqual(execution);
    expect(result.verification?.status).toBe("mismatch");

    expect(executionService.execute).toHaveBeenCalledOnce();
    expect(verificationService.verify).toHaveBeenCalledOnce();
  });

  it("returns failed when verification fails", async () => {
    const verificationService = {
      verify: vi.fn().mockResolvedValue({
        status: "failed",
        desired,
        error: "Inventory unavailable",
      } satisfies VerificationResult),
    };

    const { service } = createService({
      verificationService,
    });

    const result = await service.reconcile(desired);

    expect(result.status).toBe("failed");
    expect(result.verification?.status).toBe("failed");
    expect(result.verification).toEqual({
      status: "failed",
      desired,
      error: "Inventory unavailable",
    });
  });
});
