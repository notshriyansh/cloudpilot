import type { ReconciliationResult } from "./reconciliation";

export type ReconciliationRunStatus = "running" | "completed" | "failed";

export interface ReconciliationRunRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: ReconciliationRunStatus;
  result?: ReconciliationResult;
}
