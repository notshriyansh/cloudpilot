import type {
  DesiredState,
  EvaluatedPlan,
  Plan,
  PlanEvaluator,
} from "@cloudpilot/domain";

import type { PlanningService } from "./planning";

export interface EvaluationService {
  evaluate(desired: DesiredState): Promise<EvaluatedPlan>;
}

export function createEvaluationService(
  planningService: PlanningService,
  planEvaluator: PlanEvaluator,
): EvaluationService {
  return {
    async evaluate(desired) {
      const plan = await planningService.plan(desired);

      return planEvaluator.evaluate(plan);
    },
  };
}
