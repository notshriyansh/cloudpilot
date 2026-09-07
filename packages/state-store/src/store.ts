import type { ObservedState } from "@cloudpilot/domain";

export type ObservationStatus = "completed" | "failed";

export interface Observation {
  id: string;
  startedAt: string;
  completedAt: string;
  status: ObservationStatus;
  state: ObservedState;
}

export interface StateStore {
  saveObservation(observation: Observation): Promise<void>;
  getLatestObservation(): Promise<Observation | undefined>;
}
