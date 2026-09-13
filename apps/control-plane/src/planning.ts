import {
  createPlanFromStates,
  type DesiredState,
  type Plan,
} from "@cloudpilot/domain";
import type { StateStore } from "@cloudpilot/state-store";

export interface PlanningService {
  plan(desired: DesiredState): Promise<Plan>;
}

export function createPlanningService(stateStore: StateStore): PlanningService {
  return {
    async plan(desired: DesiredState): Promise<Plan> {
      const observation = await stateStore.getLatestObservation();

      if (observation === undefined) {
        throw new NoObservationError();
      }

      return createPlanFromStates(desired, observation.state);
    },
  };
}

export class NoObservationError extends Error {
  constructor() {
    super("No observation available");
    this.name = "NoObservationError";
  }
}
