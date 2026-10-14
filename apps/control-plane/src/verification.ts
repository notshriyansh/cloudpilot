import {
  diffStates,
  type DesiredState,
  type ObservedState,
  type VerificationResult,
} from "@cloudpilot/domain";
import type { ObservationService } from "./observation";
import {
  findWorkerScriptDrift,
  markWorkerScriptDrift,
  withoutWorkerScripts,
  type WorkerScriptReader,
} from "./worker-script-drift";

export interface VerificationService {
  verify(
    desired: DesiredState,
    observedState?: ObservedState,
  ): Promise<VerificationResult>;
}

export function createVerificationService(
  observationService: ObservationService,
  readWorkerScript: WorkerScriptReader,
): VerificationService {
  return {
    async verify(
      desired: DesiredState,
      suppliedObservedState?: ObservedState,
    ): Promise<VerificationResult> {
      try {
        console.info("verification: observation_started");

        const observation =
          suppliedObservedState === undefined
            ? await observationService.inspect()
            : undefined;

        const observedState = suppliedObservedState ?? observation!.state;

        console.info("verification: observation_completed", {
          resourceCount: observedState.resources.length,
        });

        const safeObservedState = withoutWorkerScripts(observedState);

        console.info("verification: script_drift_check_started");

        const driftedKeys = await findWorkerScriptDrift(
          desired,
          safeObservedState,
          readWorkerScript,
        );

        console.info("verification: script_drift_check_completed", {
          driftedResourceCount: driftedKeys.size,
        });

        const comparisonState = markWorkerScriptDrift(
          safeObservedState,
          driftedKeys,
        );

        const diff = diffStates(desired, comparisonState);

        console.info("verification: diff_diagnostic", {
          changeCount: diff.changes.length,
          changes: diff.changes,
        });

        if (diff.changes.length === 0) {
          return {
            status: "verified",
            desired,
            observed: safeObservedState,
            diff,
          };
        }

        return {
          status: "mismatch",
          desired,
          observed: safeObservedState,
          diff,
        };
      } catch (error) {
        return {
          status: "failed",
          desired,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
