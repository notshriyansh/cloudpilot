import type { CloudflareProvider } from "@cloudpilot/cloudflare-provider";
import type { ObservedState } from "@cloudpilot/domain";

export interface Inventory {
  inspect(): Promise<ObservedState>;
}

export function createInventory(provider: CloudflareProvider): Inventory {
  return {
    async inspect(): Promise<ObservedState> {
      const zones = await provider.listZones();

      return {
        resources: zones.map((zone) => ({
          resource: {
            type: "zone",
            id: zone.id,
          },
          attributes: {
            name: zone.name,
            status: zone.status,
          },
        })),
      };
    },
  };
}
