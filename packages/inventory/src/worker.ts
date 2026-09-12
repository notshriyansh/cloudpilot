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
      ...(worker.createdAt !== undefined
        ? { createdAt: worker.createdAt }
        : {}),
      ...(worker.modifiedAt !== undefined
        ? { modifiedAt: worker.modifiedAt }
        : {}),
      ...(worker.compatibilityDate !== undefined
        ? { compatibilityDate: worker.compatibilityDate }
        : {}),
    },
  };
}
