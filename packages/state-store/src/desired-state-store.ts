import type { DesiredState } from "@cloudpilot/domain";

export interface DesiredStateStore {
  saveDesiredState(state: DesiredState): Promise<void>;
  getDesiredState(): Promise<DesiredState | undefined>;
}
