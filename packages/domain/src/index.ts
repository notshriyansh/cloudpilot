export type { ResourceId, ResourceType } from "./resource";
export type { DesiredState, ObservedState, ResourceState } from "./state";
export { diffStates, type ResourceChange, type StateDiff } from "./diff";
export { areRelationshipsEqual, areValuesEqual } from "./compare";
export { reconcileStates } from "./reconcile";
export type {
  ResourceRelationship,
  ResourceRelationshipType,
} from "./relationship";
export type { OperationGraph, ResourceGraph } from "./graph";

export {
  buildOperationGraph,
  buildResourceGraph,
  OperationGraphCycleError,
  ResourceGraphCycleError,
  topologicalOrder,
  topologicalOrderOperations,
} from "./graph";
export type { Plan, PlanAction, PlanOperation } from "./plan";
export { createPlan } from "./planner";
export type { RiskAssessment, RiskEvaluator, RiskLevel } from "./risk";
export { createDefaultRiskEvaluator } from "./risk";
export type {
  ApprovalDecision,
  ApprovalEvaluator,
  ApprovalRequirement,
} from "./approval";
export { createDefaultApprovalEvaluator } from "./approval";
export type {
  EvaluatedOperation,
  EvaluatedPlan,
  PlanEvaluator,
} from "./evaluation";
export { createPlanEvaluator } from "./evaluation";
export type { ExecutionReadiness } from "./evaluation";
export { validateDesiredState, type ValidationError } from "./validation";
export { createPlanFromStates } from "./planning";
export { filterChangesByScope, isManaged, type ManagementScope } from "./scope";
export * from "./impact";
export type { EvaluationContext } from "./evaluation-context";
export { getDependents } from "./graph";
export * from "./execution";
export * from "./plan-executor";
export * from "./execution-service";
export { createDefaultPolicy } from "./policy";
