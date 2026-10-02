import type {
  DesiredState,
  Plan,
  VerificationResult,
} from "@cloudpilot/domain";
import type { ExecutionSummary } from "@cloudpilot/domain";

export type ReconciliationStatus =
  | "in_sync"
  | "blocked"
  | "approval_required"
  | "executed"
  | "verified"
  | "mismatch"
  | "failed";

export interface ReconciliationResult {
  status: ReconciliationStatus;
  desired: DesiredState;
  plan?: Plan;
  execution?: ExecutionSummary;
  verification?: VerificationResult;
}

export interface ReconciliationService {
  reconcile(desired: DesiredState): Promise<ReconciliationResult>;
}
