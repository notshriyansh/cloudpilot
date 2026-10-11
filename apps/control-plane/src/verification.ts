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
        const observedState =
          suppliedObservedState ?? (await observationService.inspect()).state;

        const safeObservedState = withoutWorkerScripts(observedState);

        const driftedKeys = await findWorkerScriptDrift(
          desired,
          safeObservedState,
          readWorkerScript,
        );

        const comparisonState = markWorkerScriptDrift(
          safeObservedState,
          driftedKeys,
        );

        const diff = diffStates(desired, comparisonState);

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
