import { diffStates, type DesiredState } from "@cloudpilot/domain";

import type { ObservationService } from "./observation";
import type { PlanningService } from "./planning";
import type { EvaluationService } from "./evaluation";
import type { ExecutionService } from "./execution";
import type { VerificationService } from "./verification";
import { ReconciliationService } from "./reconciliation";

export function createReconciliationService(
  observationService: ObservationService,
  planningService: PlanningService,
  evaluationService: EvaluationService,
  executionService: ExecutionService,
  verificationService: VerificationService,
): ReconciliationService {
  return {
    async reconcile(desired) {
      const observation = await observationService.inspect();

      const diff = diffStates(desired, observation.state);

      if (diff.changes.length === 0) {
        return {
          status: "in_sync",
          desired,
        };
      }

      const plan = await planningService.plan(desired);

      const evaluation = await evaluationService.evaluate(desired);

      const blockedOperations = evaluation.operations.filter(
        (operation) => operation.readiness === "blocked",
      );

      if (blockedOperations.length > 0) {
        return {
          status: "blocked",
          desired,
          plan,
        };
      }

      const approvalRequiredOperations = evaluation.operations.filter(
        (operation) => operation.readiness === "approval_required",
      );

      if (approvalRequiredOperations.length > 0) {
        return {
          status: "approval_required",
          desired,
          plan,
        };
      }

      const execution = await executionService.execute(plan);

      if (execution.status === "failed") {
        return {
          status: "failed",
          desired,
          plan,
          execution,
        };
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
    },
  };
}
