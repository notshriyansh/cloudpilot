import type { Plan, PlanOperation } from "./plan";

export type ExecutionStatus = "succeeded" | "failed" | "skipped";

export interface ExecutionResult {
  operation: PlanOperation;
  status: ExecutionStatus;
  error?: string;
}

export interface ExecutionReport {
  results: ExecutionResult[];
}

export interface OperationExecutor {
  execute(operation: PlanOperation): Promise<ExecutionResult>;
}

export interface PlanExecutor {
  execute(plan: Plan): Promise<ExecutionReport>;
}
