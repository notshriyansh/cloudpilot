import { diffStates } from "@cloudpilot/domain";
import type {
  DesiredStateStore,
  ReconciliationRunStore,
} from "@cloudpilot/state-store";
import type { Clock, IdGenerator, ObservationService } from "./observation";
import type { PlanningService } from "./planning";
import type { EvaluationService } from "./evaluation";
import type { ExecutionService } from "./execution";
import type { VerificationService } from "./verification";
import type {
  ReconciliationResult,
  ReconciliationService,
} from "./reconciliation";

export class NoDesiredStateError extends Error {
  constructor() {
    super("No desired state configured");
    this.name = "NoDesiredStateError";
  }
}

export class ReconciliationAlreadyRunningError extends Error {
  constructor() {
    super("A reconciliation is already running");
    this.name = "ReconciliationAlreadyRunningError";
  }
}

export function createReconciliationService(
  desiredStateStore: DesiredStateStore,
  observationService: ObservationService,
  planningService: PlanningService,
  evaluationService: EvaluationService,
  executionService: ExecutionService,
  verificationService: VerificationService,
  reconciliationRunStore: ReconciliationRunStore,
  clock: Clock,
  idGenerator: IdGenerator,
): ReconciliationService {
  return {
    async reconcile() {
      const run = {
        id: idGenerator.generate(),
        startedAt: clock.now().toISOString(),
        status: "running" as const,
      };

      const claimed = await reconciliationRunStore.startRun(run);

      if (!claimed) {
        throw new ReconciliationAlreadyRunningError();
      }

      let result: ReconciliationResult;

      try {
        result = await performReconciliation(
          desiredStateStore,
          observationService,
          planningService,
          evaluationService,
          executionService,
          verificationService,
        );
      } catch (error) {
        await reconciliationRunStore.saveRun({
          ...run,
          completedAt: clock.now().toISOString(),
          status: "failed",
          result: {
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          },
        });

        throw error;
      }

      await reconciliationRunStore.saveRun({
        ...run,
        completedAt: clock.now().toISOString(),
        status: result.status === "failed" ? "failed" : "succeeded",
        result,
      });

      return result;
    },
  };
}

async function performReconciliation(
  desiredStateStore: DesiredStateStore,
  observationService: ObservationService,
  planningService: PlanningService,
  evaluationService: EvaluationService,
  executionService: ExecutionService,
  verificationService: VerificationService,
): Promise<ReconciliationResult> {
  const desired = await desiredStateStore.getDesiredState();

  if (desired === undefined) {
    throw new NoDesiredStateError();
  }

  const observation = await observationService.inspect();
  const diff = diffStates(desired, observation.state);

  if (diff.changes.length === 0) {
    return { status: "in_sync", desired };
  }

  const plan = await planningService.plan(desired);
  const evaluation = await evaluationService.evaluate(desired);

  const blockedOperations = evaluation.operations.filter(
    (operation) => operation.readiness === "blocked",
  );

  if (blockedOperations.length > 0) {
    return { status: "blocked", desired, plan };
  }

  const approvalRequiredOperations = evaluation.operations.filter(
    (operation) => operation.readiness === "approval_required",
  );

  if (approvalRequiredOperations.length > 0) {
    return { status: "approval_required", desired, plan };
  }

  const execution = await executionService.execute(plan);

  if (execution.status === "failed") {
    return { status: "failed", desired, plan, execution };
  }

  const verification = await verificationService.verify(desired);

  return {
    status:
      verification.status === "verified"
        ? "verified"
        : verification.status === "mismatch"
          ? "mismatch"
          : "failed",
    desired,
    plan,
    execution,
    verification,
  };
}
