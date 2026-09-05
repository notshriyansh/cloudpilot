import type { StateDiff } from "./diff";
import { diffStates } from "./diff";
import type { DesiredState, ObservedState } from "./state";

export function reconcileStates(
  desired: DesiredState,
  observed: ObservedState,
): StateDiff {
  return diffStates(desired, observed);
}
