import type { CloudflareWorker } from "@cloudpilot/cloudflare-provider";
import type { ResourceState } from "@cloudpilot/domain";

export function cloudflareWorkerToResource(
  worker: CloudflareWorker,
  script: string,
): ResourceState {
  return {
    resource: {
      type: "worker",
      id: worker.id,
    },
    attributes: {
      script,
      ...(worker.compatibilityDate !== undefined
        ? { compatibilityDate: worker.compatibilityDate }
        : {}),
    },
  };
}
