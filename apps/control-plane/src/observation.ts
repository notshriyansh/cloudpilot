import type { Inventory } from "@cloudpilot/inventory";
import type { Observation, StateStore } from "@cloudpilot/state-store";

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export interface ObservationService {
  inspect(): Promise<Observation>;
}

export function createObservationService(
  inventory: Inventory,
  stateStore: StateStore,
  clock: Clock,
  idGenerator: IdGenerator,
): ObservationService {
  return {
    async inspect(): Promise<Observation> {
      const startedAt = clock.now();

      const state = await inventory.inspect();

      const completedAt = clock.now();

      const observation: Observation = {
        id: idGenerator.generate(),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        status: "completed",
        state,
      };

      await stateStore.saveObservation(observation);

      return observation;
    },
  };
}
