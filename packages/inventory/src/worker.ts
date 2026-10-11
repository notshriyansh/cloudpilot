import type { CloudflareWorker } from "@cloudpilot/cloudflare-provider";
import type { ResourceState } from "@cloudpilot/domain";

export function cloudflareWorkerToResource(
  worker: CloudflareWorker,
): ResourceState {
  return {
    resource: {
      type: "worker",
      id: worker.id,
    },
    attributes: {
      ...(worker.compatibilityDate !== undefined
        ? { compatibilityDate: worker.compatibilityDate }
        : {}),
    },
  };
}
