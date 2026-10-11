import {
  createPlanFromStates,
  type DesiredState,
  type Plan,
} from "@cloudpilot/domain";
import type { ManagementScopeStore, StateStore } from "@cloudpilot/state-store";
import {
  findWorkerScriptDrift,
  markWorkerScriptDrift,
  withoutWorkerScripts,
  type WorkerScriptReader,
} from "./worker-script-drift";

export interface PlanningService {
  plan(desired: DesiredState): Promise<Plan>;
}

export function createPlanningService(
  stateStore: StateStore,
  managementScopeStore: ManagementScopeStore,
  readWorkerScript: WorkerScriptReader,
): PlanningService {
  return {
    async plan(desired: DesiredState): Promise<Plan> {
      const observation = await stateStore.getLatestObservation();

      if (observation === undefined) {
        throw new NoObservationError();
      }

      const scope = await managementScopeStore.getScope();
      const observed = withoutWorkerScripts(observation.state);

      const driftedKeys = await findWorkerScriptDrift(
        desired,
        observed,
        readWorkerScript,
      );

      const planningState = markWorkerScriptDrift(observed, driftedKeys);

      return createPlanFromStates(desired, planningState, scope);
    },
  };
}

export class NoObservationError extends Error {
  constructor() {
    super("No observation available");
    this.name = "NoObservationError";
  }
}
