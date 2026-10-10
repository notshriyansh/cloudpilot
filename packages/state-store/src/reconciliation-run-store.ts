export type ReconciliationRunStatus = "running" | "completed" | "failed";

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
  startRun(run: ReconciliationRunRecord): Promise<boolean>;
}
