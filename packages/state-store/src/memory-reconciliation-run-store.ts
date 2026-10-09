import type {
  ReconciliationRunRecord,
  ReconciliationRunStore,
} from "./reconciliation-run-store";

export function createMemoryReconciliationRunStore(): ReconciliationRunStore {
  const runs = new Map<string, ReconciliationRunRecord>();

  return {
    async saveRun(run) {
      runs.set(run.id, run);
    },

    async getRun(id) {
      return runs.get(id);
    },

    async getLatestRun() {
      return [...runs.values()].sort(
        (a, b) =>
          b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id),
      )[0];
    },
  };
}
