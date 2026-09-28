import type { ExecutionRecord } from "@cloudpilot/domain";

export interface ExecutionStore {
  saveExecution(execution: ExecutionRecord): Promise<void>;
  getExecution(id: string): Promise<ExecutionRecord | undefined>;
  getLatestExecution(): Promise<ExecutionRecord | undefined>;
}
