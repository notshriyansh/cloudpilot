import { buildResourceGraph } from "./graph";
import { createPlan } from "./planner";
import { reconcileStates } from "./reconcile";
import { filterChangesByScope, type ManagementScope } from "./scope";
import { resourceIdKey } from "./state";
import type { DesiredState, ObservedState } from "./state";
import type { Plan } from "./plan";

export function createPlanFromStates(
  desired: DesiredState,
  observed: ObservedState,
  scope: ManagementScope,
): Plan {
  const diff = reconcileStates(desired, observed);
  const scopedDiff = filterChangesByScope(diff, scope);

  const resourcesByKey = new Map(
    [...observed.resources, ...desired.resources].map((resource) => [
      resourceIdKey(resource.resource),
      resource,
    ]),
  );

  const graph = buildResourceGraph([...resourcesByKey.values()]);

  return createPlan(scopedDiff, graph);
}
