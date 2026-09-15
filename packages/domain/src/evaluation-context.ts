import type { ImpactAnalysis } from "./impact";
import type { Plan } from "./plan";

export interface EvaluationContext {
  plan: Plan;
  impact: Map<string, ImpactAnalysis>;
}
