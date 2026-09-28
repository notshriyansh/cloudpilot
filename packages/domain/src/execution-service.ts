import type { ExecutionResult, OperationExecutor } from "./execution";
import type { Plan } from "./plan";
import { createPlanExecutor } from "./plan-executor";

export interface ExecutionSummary {
  status: "succeeded" | "failed";

  results: ExecutionResult[];

  completed: number;

  failed: number;

  skipped: number;
}

export type ExecutionLifecycleStatus = "running" | "succeeded" | "failed";

export interface ExecutionRecord {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: ExecutionLifecycleStatus;
  summary?: ExecutionSummary;
}

export interface ExecutionService {
  execute(plan: Plan): Promise<ExecutionSummary>;
}

export function createExecutionService(
  operationExecutor: OperationExecutor,
): ExecutionService {
  const planExecutor = createPlanExecutor(operationExecutor);

  return {
    async execute(plan: Plan): Promise<ExecutionSummary> {
      const report = await planExecutor.execute(plan);

      const completed = report.results.filter(
        (result) => result.status === "succeeded",
      ).length;

      const failed = report.results.filter(
        (result) => result.status === "failed",
      ).length;

      const skipped = report.results.filter(
        (result) => result.status === "skipped",
      ).length;

      return {
        status: failed > 0 ? "failed" : "succeeded",
        results: report.results,
        completed,
        failed,
        skipped,
      };
    },
  };
}
