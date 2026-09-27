import type { ExecutionRecord } from "@cloudpilot/domain";
import type { ExecutionStore } from "./execution-store";

export function createMemoryExecutionStore(): ExecutionStore {
  const executions = new Map<string, ExecutionRecord>();

  return {
    async saveExecution(execution) {
      executions.set(execution.id, execution);
    },

    async getExecution(id) {
      return executions.get(id);
    },
  };
}
