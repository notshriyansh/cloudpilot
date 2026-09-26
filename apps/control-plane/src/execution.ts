import type {
  ExecutionReport,
  OperationExecutor,
  Plan,
  PlanExecutor,
} from "@cloudpilot/domain";

import { createPlanExecutor } from "@cloudpilot/domain";

export interface ExecutionService {
  execute(plan: Plan): Promise<ExecutionReport>;
}

export function createExecutionService(
  operationExecutor: OperationExecutor,
): ExecutionService {
  const planExecutor: PlanExecutor = createPlanExecutor(operationExecutor);

  return {
    async execute(plan: Plan): Promise<ExecutionReport> {
      return planExecutor.execute(plan);
    },
  };
}
