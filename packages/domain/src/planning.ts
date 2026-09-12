import { buildResourceGraph } from "./graph";
import { createPlan } from "./planner";
import { reconcileStates } from "./reconcile";
import { resourceIdKey } from "./state";
import type { DesiredState, ObservedState } from "./state";
import type { Plan } from "./plan";

export function createPlanFromStates(
  desired: DesiredState,
  observed: ObservedState,
): Plan {
  const diff = reconcileStates(desired, observed);

  const resourcesByKey = new Map(
    [...observed.resources, ...desired.resources].map((resource) => [
      resourceIdKey(resource.resource),
      resource,
    ]),
  );

  const graph = buildResourceGraph([...resourcesByKey.values()]);

  return createPlan(diff, graph);
}
