import {
  diffStates,
  type DesiredState,
  type VerificationResult,
} from "@cloudpilot/domain";
import type { ObservationService } from "./observation";

export interface VerificationService {
  verify(desired: DesiredState): Promise<VerificationResult>;
}

export function createVerificationService(
  observationService: ObservationService,
): VerificationService {
  return {
    async verify(desired): Promise<VerificationResult> {
      try {
        const observed = await observationService.inspect();

        const diff = diffStates(desired, observed.state);

        if (diff.changes.length === 0) {
          return {
            status: "verified",
            desired,
            observed: observed.state,
            diff,
          };
        }

        return {
          status: "mismatch",
          desired,
          observed: observed.state,
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
