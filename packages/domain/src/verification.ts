import type { DesiredState, ObservedState } from "./state";
import type { StateDiff } from "./diff";

export type VerificationStatus = "verified" | "mismatch" | "failed";

export interface VerificationResult {
  status: VerificationStatus;
  desired: DesiredState;
  observed?: ObservedState;
  diff?: StateDiff;
  error?: string;
}
