import { PlanOperation } from "@cloudpilot/domain";

export type ResourceState = {
  resource: {
    type: string;
    id: string;
  };
  attributes: Record<string, unknown>;
  relationships?: unknown[];
};

export type DesiredState = {
  resources: ResourceState[];
};

export type EvaluatedOperation = {
  operation: PlanOperation;
  policy: Record<string, unknown>;
  risk: Record<string, unknown>;
  approval: Record<string, unknown>;
  readiness: "ready" | "blocked" | "approval_required";
};

export type EvaluatedPlan = {
  operations: EvaluatedOperation[];
};

export const emptyDesiredState: DesiredState = {
  resources: [],
};

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}
