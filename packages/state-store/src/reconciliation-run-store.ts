export type ReconciliationRunStatus = "running" | "succeeded" | "failed";

export interface ReconciliationRunRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: ReconciliationRunStatus;
  result?: unknown;
}

export interface ReconciliationRunStore {
  saveRun(run: ReconciliationRunRecord): Promise<void>;
  getRun(id: string): Promise<ReconciliationRunRecord | undefined>;
  getLatestRun(): Promise<ReconciliationRunRecord | undefined>;
}
