import type { CloudflareZone } from "@cloudpilot/cloudflare-provider";
import type { ResourceState } from "@cloudpilot/domain";

export function cloudflareZoneToResource(zone: CloudflareZone): ResourceState {
  return {
    resource: {
      type: "zone",
      id: zone.id,
    },
    attributes: {
      name: zone.name,
      status: zone.status,
      accountId: zone.accountId,
    },
  };
}
