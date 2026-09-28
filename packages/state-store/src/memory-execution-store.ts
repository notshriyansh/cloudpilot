import type { ExecutionRecord } from "@cloudpilot/domain";
import type { ExecutionStore } from "./execution-store";

export function createMemoryExecutionStore(): ExecutionStore {
  const executions: ExecutionRecord[] = [];

  return {
    async saveExecution(execution): Promise<void> {
      const existingIndex = executions.findIndex(
        (candidate) => candidate.id === execution.id,
      );

      if (existingIndex === -1) {
        executions.push(execution);
      } else {
        executions[existingIndex] = execution;
      }
    },

    async getExecution(id): Promise<ExecutionRecord | undefined> {
      return executions.find((execution) => execution.id === id);
    },

    async getLatestExecution(): Promise<ExecutionRecord | undefined> {
      return executions.at(-1);
    },
  };
}
