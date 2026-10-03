import type { DesiredState } from "@cloudpilot/domain";
import type { DesiredStateStore } from "./desired-state-store";

export function createMemoryDesiredStateStore(): DesiredStateStore {
  let state: DesiredState | undefined;

  return {
    async saveDesiredState(nextState): Promise<void> {
      state = nextState;
    },

    async getDesiredState(): Promise<DesiredState | undefined> {
      return state;
    },
  };
}
